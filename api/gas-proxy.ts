const STUDENT_ACTIONS = new Set(['getRosterOptions','verifyStudent','loadProgress','getProgress','saveProgress','saveTests','updateRevision','submitFinal','submitCounseling','resetStudentData','logoutStudent','getSaveStatus']);

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({success:false,message:'Method Not Allowed'});
  const payload = req.body || {};
  if (!STUDENT_ACTIONS.has(payload.action) || payload.adminSecret) return res.status(403).json({success:false,message:'허용되지 않은 요청입니다.'});
  const target = process.env.GAS_URL;
  if (!target?.startsWith('https://')) return res.status(500).json({success:false,message:'GAS_URL 환경변수가 설정되지 않았습니다.'});
  const writing = ['saveProgress','saveTests','updateRevision','submitFinal','submitCounseling','resetStudentData','getSaveStatus'].includes(payload.action);
  const tracing=process.env.STAGING_PERF_MODE==='synthetic-25' && /^[-a-zA-Z0-9]{16,80}$/.test(payload.performanceRunId||'');
  const correlationId=tracing?globalThis.crypto.randomUUID():undefined,started=Date.now();
  if(correlationId)res.setHeader('X-Staging-Correlation-Id',correlationId);
  const diagnostic=(stage:string,details:Record<string,string|number|boolean>={})=>{if(tracing)console.info(JSON.stringify({correlationId,stage,elapsedMs:Date.now()-started,...details}));};
  try {
    const signal=AbortSignal.timeout(writing?75000:15000);
    let next=target,method='POST',body:string|undefined=JSON.stringify(correlationId?{...payload,performanceTraceId:correlationId}:payload),response:Response|undefined;
    for(let hop=0;hop<8;hop++) {
      const at=Date.now();diagnostic('proxy-fetch');
      response=await fetch(next,{method,headers:method==='POST'?{'Content-Type':'text/plain;charset=utf-8'}:{},body,redirect:'manual',signal,cache:'no-store'});
      const host=response.url?new URL(response.url).hostname:new URL(next).hostname;
      diagnostic(`proxy-hop-${hop}`,{upstreamStatus:response.status||0,googleAppsScriptHost:host==='script.google.com'||host==='script.googleusercontent.com',durationMs:Date.now()-at});
      if(![301,302,303,307,308].includes(response.status))break;
      const location=response.headers.get('location');if(!location)throw Error('redirect');
      const destination=new URL(location,next);
      if(destination.protocol!=='https:'||!['script.google.com','script.googleusercontent.com',new URL(target).hostname].includes(destination.hostname))throw Error('redirect scope');
      if(response.status===303||(response.status===301||response.status===302)&&method==='POST'){method='GET';body=undefined;}
      next=destination.href;if(hop===7)throw Error('redirect limit');
    }
    if(!response)throw Error('upstream');
    const mime=response.headers?.get('content-type')||'',size=Number(response.headers?.get('content-length'));
    diagnostic('proxy-response',{contentType:/application\/json/i.test(mime)?'application/json':/text\/html/i.test(mime)?'text/html':'other',responseSize:Number.isFinite(size)&&size>=0?size:0});
    // Never forward HTML/error bodies, which can contain deployment URLs.
    if (!response.ok) return res.status(response.status === 429 ? 429 : 502).json({success:false,message:'서버 응답 오류입니다. 잠시 후 다시 시도해 주세요.'});
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    diagnostic('proxy-failed',{errorKind:error?.name==='TimeoutError'?'timeout':'transport-or-json',exceptionName:['TimeoutError','SyntaxError','TypeError'].includes(error?.name)?error.name:'Error'});
    // A timed-out GAS write can still finish. Do not trigger an automatic retry.
    return res.status(error?.name === 'TimeoutError' ? 504 : 502).json({success:false,message:'서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'});
  }
}
