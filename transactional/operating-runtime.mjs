// Explicit operating adapter: never imports fixture data or falls back to GAS on failure.
import {randomUUID} from 'node:crypto';
import {openDatabase,createRegisteredService} from './store.mjs';

const studentActions=new Set(['getRosterOptions','verifyStudent','loadProgress','getProgress','saveProgress','saveTests','updateRevision','submitFinal','submitCounseling','logoutStudent','getSaveStatus']);
const adminActions=new Set(['checkAdminConfig','getAdminDashboard','getStudentDetail','updateRoster','deleteRosterStudents']);
const rosterWrites=new Set(['updateRoster','deleteRosterStudents']);
const faults=new Set(['AUTH','SCOPE','REQUEST','VERSION_CONFLICT','CANCELLED','ID_REUSE','EXPIRED','MAINTENANCE','STALE_EPOCH']);
function configFault(){return Object.assign(new Error('운영 저장소 설정을 확인하지 못했습니다.'),{code:'CONFIG'});}
export function operatingConfiguration(env=process.env){
  if(env.OPERATING_POSTGRES!=='enabled'||env.TRANSACTIONAL_SYNTHETIC||env.TRANSACTIONAL_REGISTERED_REHEARSAL_SCHEMA||
     env.VERCEL_ENV!=='production'||env.OPERATING_SCHEMA!=='role_model_operating'||
     typeof env.OPERATING_SESSION_SECRET!=='string'||env.OPERATING_SESSION_SECRET.length<32)throw configFault();
  if(Object.entries(env).some(([k,v])=>/^(STAGING_|TEST_|PERF_TEST_)/.test(k)&&v&&!['false','0','disabled'].includes(v)))throw configFault();
  if(env.LOGIN_BATCH_READS&&!['false','0','disabled'].includes(env.LOGIN_BATCH_READS))throw configFault();
  let url;try{url=new URL(env.OPERATING_DATABASE_URL);}catch{throw configFault();}
  if(!['postgres:','postgresql:'].includes(url.protocol)||decodeURIComponent(url.username)!=='postgres.rxzholiocjaczueobhsr'||
     !/^aws-[0-9]+-ap-northeast-2\.pooler\.supabase\.com$/.test(url.hostname)||url.port!=='6543'||url.pathname!=='/postgres'||!url.password||url.password.includes('YOUR-PASSWORD'))throw configFault();
  return {url:url.href,schema:env.OPERATING_SCHEMA,secret:env.OPERATING_SESSION_SECRET};
}
export function makeOperatingDispatch({env=process.env,connect=openDatabase,create=createRegisteredService}={}){
  let service;
  return async(payload,options={})=>{
    const cfg=operatingConfiguration(env);
    if(!payload||!(options.admin?adminActions:studentActions).has(payload.action)||!options.admin&&payload.adminSecret)throw Object.assign(new Error('허용되지 않은 요청입니다.'),{code:'SCOPE'});
    if(!service)service=(async()=>{
      const db=await connect({url:cfg.url,schema:cfg.schema,mode:'registered'});
      try{return await create(db,cfg.secret);}catch(error){await db.close();throw error;}
    })();
    let app;try{app=await service;}catch{service=undefined;throw configFault();}
    if(options.admin&&rosterWrites.has(payload.action)){
      const state=await app.maintenanceStatus();
      if(state.epoch>0&&(!Number.isSafeInteger(options.adminIssuedAt)||options.adminIssuedAt<state.openedAt))throw Object.assign(new Error('관리자로 다시 로그인해 주세요.'),{code:'STALE_EPOCH'});
      options={...options,adminEpoch:state.epoch};payload={...payload,requestIssuedAt:Date.now()};
    }
    const result=await app.dispatch(payload,options);
    return {...result,storageBackend:'transactional-postgres'};
  };
}
export const operatingDispatch=makeOperatingDispatch();
export async function operatingHttp(req,res){
  const correlationId=randomUUID(),at=performance.now();
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Correlation-Id',correlationId);
  try{
    const result=await operatingDispatch(req.body);
    console.info(JSON.stringify({correlationId,stage:'operating-response',success:result.success===true,elapsedMs:performance.now()-at,...result.metrics}));
    return res.status(200).json(result);
  }catch(e){
    const code=faults.has(e.code)?e.code:'UNAVAILABLE';
    console.info(JSON.stringify({correlationId,stage:'operating-failure',errorKind:code,elapsedMs:performance.now()-at}));
    return res.status(200).json({success:false,code,storageBackend:'transactional-postgres',message:'서버 요청을 확인하지 못했습니다. 입력 내용을 보관하고 저장 결과를 확인해 주세요.'});
  }
}
