import {registeredIdentity} from './roster.mjs';
import {assertSyntheticEnvironment,openDatabase,verifyInitialized,createService,fixture} from './store.mjs';
import {randomUUID} from 'node:crypto';
let service;
export function assertRegisteredRehearsalRoster(payload) {
  if(!['updateRoster','deleteRosterStudents'].includes(payload.action))return;
  if(!Array.isArray(payload.students)||payload.students.some(value=>{
    const identity=registeredIdentity(value,{deletion:payload.action==='deleteRosterStudents'});
    return !fixture.some(f=>Object.entries(identity).every(([k,v])=>f[k]===v));
  }))throw Object.assign(new Error('합성 시험 범위 밖의 명단은 처리하지 않습니다.'),{code:'SCOPE'});
}
export async function syntheticDispatch(payload,options) {
  assertSyntheticEnvironment();
  if(process.env.TRANSACTIONAL_REGISTERED_REHEARSAL_SCHEMA)assertRegisteredRehearsalRoster(payload);
  if(process.env.VERCEL && !process.env.TRANSACTIONAL_DATABASE_URL)throw Object.assign(new Error('Preview에는 PostgreSQL 연결이 필요합니다.'),{code:'CONFIG'});
  if(!service)service=(async()=>{
    const schema=process.env.TRANSACTIONAL_REGISTERED_REHEARSAL_SCHEMA;
    if(schema&&!/^role_model_synthetic_rehearsal_[a-z0-9_]+$/.test(schema))throw Object.assign(new Error('합성 리허설 스키마만 허용됩니다.'),{code:'CONFIG'});
    if(schema&&decodeURIComponent(new URL(process.env.TRANSACTIONAL_DATABASE_URL).username)!=='postgres.vanvpimargvummzqunto')throw Object.assign(new Error('합성 프로젝트가 아닙니다.'),{code:'CONFIG'});
    const db=await openDatabase({file:process.env.TRANSACTIONAL_DB_FILE,url:process.env.TRANSACTIONAL_DATABASE_URL,...(schema?{schema}:{})});
    await verifyInitialized(db,schema?{registered:true,identities:fixture,strictFixture:true}:undefined);
    if(schema)return createService(db,process.env.TRANSACTIONAL_SESSION_SECRET,{validateIdentity:registeredIdentity});
    return createService(db,process.env.TRANSACTIONAL_SESSION_SECRET);
  })();
  try { const app=await service; if(options?.admin){const state=await app.maintenanceStatus();if(['updateRoster','deleteRosterStudents'].includes(payload.action)&&state.epoch>0&&(!Number.isSafeInteger(options.adminIssuedAt)||options.adminIssuedAt<state.openedAt))throw Object.assign(new Error('새로 관리자 로그인한 뒤 다시 확인해 주세요.'),{code:'STALE_EPOCH'});options={...options,adminEpoch:state.epoch};payload={...payload,requestIssuedAt:Date.now()};} return await app.dispatch(payload,options); }
  catch(e){if(e.code && ['AUTH','SCOPE','REQUEST','VERSION_CONFLICT','CANCELLED','ID_REUSE','EXPIRED','CONFIG','DISABLED','MAINTENANCE','STALE_EPOCH'].includes(e.code))throw e;throw new Error('합성 저장소 연결 또는 처리 실패');}
}
export async function syntheticHttp(req,res) {
  const correlationId=randomUUID(),at=performance.now();res.setHeader('X-Synthetic-Correlation-Id',correlationId);
  try{const result=await syntheticDispatch(req.body);console.info(JSON.stringify({correlationId,stage:'synthetic-response',success:result.success===true,elapsedMs:performance.now()-at,...result.metrics}));return res.status(200).json(result);}
  catch(e){console.info(JSON.stringify({correlationId,stage:'synthetic-failure',errorKind:e.code||'UNAVAILABLE',elapsedMs:performance.now()-at}));return res.status(200).json({success:false,code:e.code||'UNAVAILABLE',message:e.code?e.message:'저장 결과를 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.',storageBackend:'transactional-synthetic'});}
}
