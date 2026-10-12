import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
type Claims={runId:string;exp:number;sheet:string;origin:string;subject:string};
const lifetime=10*60*1000;
export function signTestToken(claims:Claims,secret:string) {
  const body=Buffer.from(JSON.stringify(claims)).toString('base64url');
  return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
export function verifyTestToken(token:string,secret:string,expected:{sheet:string;origin:string},now=Date.now()):Claims {
  if(typeof token!=='string'||token.length>2048)throw Error('invalid token');
  const parts=token.split('.');if(parts.length!==2)throw Error('invalid token');
  const actual=Buffer.from(parts[1],'base64url'),correct=createHmac('sha256',secret).update(parts[0]).digest();
  if(actual.length!==correct.length||!timingSafeEqual(actual,correct))throw Error('invalid signature');
  const c=JSON.parse(Buffer.from(parts[0],'base64url').toString());
  if(!Number.isFinite(c.exp)||c.exp<=now||c.exp>now+lifetime||c.sheet!==expected.sheet||c.origin!==expected.origin||!/^[-a-zA-Z0-9]{16,80}$/.test(c.runId)||!(/^(run|3-99-([1-9]|1[0-9]|2[0-5]))$/).test(c.subject))throw Error('invalid scope');
  return c;
}
export function verifySyntheticRequest(body:any,subject:string) {
  if(!['verifyStudent','saveProgress','saveTests','submitFinal','loadProgress','getSaveStatus'].includes(body?.action)||subject==='run')throw Error('invalid action');
  if(body.progress||body.tests||body.submission||body.counseling||body.studentKey && body.studentKey!==subject)throw Error('invalid student');
  const number=Number(subject.split('-')[2]);
  if(body.action==='verifyStudent') {
    if(Number(body.grade)!==3||Number(body.classNum)!==99||Number(body.number)!==number||String(body.name||'').normalize('NFKC').replace(/\s+/g,'')!==`SyntheticStudent${number}`)throw Error('invalid student');
  } else if(body.studentKey!==subject||body.progress||body.tests||body.submission||body.counseling)throw Error('invalid student');
  if(body.googleId && body.googleId!==`synthetic${number}@example.invalid`)throw Error('invalid identity');
}
export default async function handler(req:any,res:any) {
  res.setHeader('Cache-Control','no-store');
  const correlationId=randomUUID(),started=Date.now();
  res.setHeader('X-Staging-Correlation-Id',correlationId);
  let stage='guard';
  const diagnostic=(phase:string,details:Record<string,string|number|boolean>={})=>console.info(JSON.stringify({correlationId,stage:phase,elapsedMs:Date.now()-started,...details}));
  const failure=(error:any)=>diagnostic(stage,{exceptionName:['TimeoutError','AbortError','TypeError','SyntaxError','Error'].includes(error?.name)?error.name:'OtherError',errorKind:error?.name==='TimeoutError'?'timeout':error?.name==='SyntaxError'?'invalid-json':error?.name==='TypeError'?'transport':'upstream-or-validation'});
  const env=process.env,origin=env.STAGING_ORIGIN;
  if(env.STAGING_PERF_MODE!=='synthetic-25'||!origin||!/^https:\/\/staging-[a-z0-9-]+\.vercel\.app$/.test(origin))return res.status(404).json({success:false});
  if(req.method!=='POST')return res.status(405).json({success:false});
  if(req.headers.host!==new URL(origin).host || req.headers.origin && req.headers.origin!==origin)return res.status(403).json({success:false});
  const target=env.TEST_GAS_URL,secret=env.STAGING_TOKEN_SECRET;
  if(!target?.startsWith('https://script.google.com/')||!env.TEST_SPREADSHEET_ID||!env.STAGING_GAS_ADMIN_SECRET||!secret||secret.length<32)return res.status(503).json({success:false});
  const call=async(body:any)=>{
    stage='upstream-fetch';const at=Date.now();diagnostic(stage);
    const writing=['saveProgress','saveTests','submitFinal','getSaveStatus'].includes(body.action);
    const signal=AbortSignal.timeout(writing?75000:45000);
    let next=target,method='POST',payload:string|undefined=JSON.stringify(body),r:Response|undefined;
    for(let hop=0;hop<8;hop++) {
      const hopAt=Date.now();
      r=await fetch(next,{method,headers:method==='POST'?{'Content-Type':'text/plain'}:{},body:payload,redirect:'manual',signal,cache:'no-store'});
      const host=r.url?new URL(r.url).hostname:new URL(next).hostname;
      diagnostic(`upstream-hop-${hop}`,{upstreamStatus:r.status||0,googleAppsScriptHost:host==='script.google.com'||host==='script.googleusercontent.com',durationMs:Date.now()-hopAt});
      if(![301,302,303,307,308].includes(r.status))break;
      const location=r.headers.get('location');if(!location)throw Error('redirect');
      const destination=new URL(location,next);
      diagnostic(destination.hostname==='script.googleusercontent.com'?'redirect-to-content':destination.hostname==='script.google.com'&&destination.pathname===new URL(target).pathname?'redirect-to-execution':'redirect-to-other',{durationMs:Date.now()-hopAt});
      if(destination.protocol!=='https:'||!['script.google.com','script.googleusercontent.com'].includes(destination.hostname))throw Error('redirect scope');
      if(r.status===303||(r.status===301||r.status===302)&&method==='POST'){method='GET';payload=undefined;}
      next=destination.href;
      if(hop===7)throw Error('redirect limit');
    }
    if(!r)throw Error('upstream');
    stage='upstream-response';
    const host=r.url?new URL(r.url).hostname:'';
    const mime=(r.headers?.get('content-type')||'').split(';')[0].trim().toLowerCase();
    diagnostic(stage,{upstreamStatus:r.status||0,contentType:['application/json','text/plain','text/html'].includes(mime)?mime:'other',googleAppsScriptHost:host==='script.google.com'||host==='script.googleusercontent.com',durationMs:Date.now()-at});
    if(!r.ok)throw Error('upstream');
    stage='upstream-body';const readAt=Date.now();
    const raw=typeof r.text==='function'?await r.text():JSON.stringify(await r.json());
    diagnostic(stage,{responseBytes:Buffer.byteLength(raw,'utf8'),durationMs:Date.now()-readAt});
    stage='upstream-json';const parsed=JSON.parse(raw);diagnostic(stage);return parsed;
  };
  const body=req.body||{};
  if(body.action==='startPerformanceRun') {
    if(!env.STAGING_TEST_SECRET||req.headers.authorization!==`Bearer ${env.STAGING_TEST_SECRET}`)return res.status(403).json({success:false});
    const runId=randomUUID(),exp=Date.now()+lifetime;
    try {
      const fixture=await call({action:'getPerformanceFixture',adminSecret:env.STAGING_GAS_ADMIN_SECRET,createPerformanceRun:{runId,exp},performanceTraceId:correlationId});
      stage='fixture-validation';diagnostic(stage);
      if(fixture.protocol!=='staging-session-v2'||fixture.runId!==runId||!fixture.success||fixture.marker!=='synthetic-25'||fixture.spreadsheetId!==env.TEST_SPREADSHEET_ID||fixture.foreignRows||fixture.duplicates)return res.status(409).json({success:false});
      const base={runId,exp,sheet:env.TEST_SPREADSHEET_ID,origin};
      return res.json({success:true,fixture,expiresAt:exp,runToken:signTestToken({...base,subject:'run'},secret),studentTokens:Array.from({length:25},(_,i)=>signTestToken({...base,subject:`3-99-${i+1}`},secret))});
    }catch(error:any){failure(error);return res.status(error?.name==='TimeoutError'?504:502).json({success:false,message:'staging start failed'});}
  }
  let claims:Claims;
  try {
    claims=verifyTestToken(String(req.headers.authorization||'').replace(/^Bearer /,''),secret,{sheet:env.TEST_SPREADSHEET_ID,origin});
    if(['getPerformanceSnapshot','finishPerformanceRun','getPerformanceTrace'].includes(body.action)) {if(claims.subject!=='run')throw Error('scope');}
    else verifySyntheticRequest(body,claims.subject);
  }catch{return res.status(403).json({success:false,message:'invalid staging test token'});}
  try {
    const admin=['getPerformanceSnapshot','finishPerformanceRun','getPerformanceTrace'].includes(body.action);
    return res.json(await call({...body,createPerformanceRun:undefined,performanceRunId:claims.runId,performanceSubject:claims.subject,performanceTraceId:correlationId,adminSecret:admin?env.STAGING_GAS_ADMIN_SECRET:undefined,measurePerformance:true}));
  }catch(error:any){failure(error);return res.status(error?.name==='TimeoutError'?504:502).json({success:false,message:'staging outcome unknown'});}
}
