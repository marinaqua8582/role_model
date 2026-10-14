import {assertSyntheticEnvironment,openDatabase,verifyInitialized,createService} from './store.mjs';
import {randomUUID} from 'node:crypto';
let service;
export async function syntheticDispatch(payload,options) {
  assertSyntheticEnvironment();
  if(process.env.VERCEL && !process.env.TRANSACTIONAL_DATABASE_URL)throw Object.assign(new Error('Preview에는 PostgreSQL 연결이 필요합니다.'),{code:'CONFIG'});
  if(!service)service=(async()=>{const db=await openDatabase({file:process.env.TRANSACTIONAL_DB_FILE,url:process.env.TRANSACTIONAL_DATABASE_URL});await verifyInitialized(db);return createService(db,process.env.TRANSACTIONAL_SESSION_SECRET);})();
  try { const app=await service; if(options?.admin){const state=await app.maintenanceStatus();if(['updateRoster','deleteRosterStudents'].includes(payload.action)&&state.epoch>0&&(!Number.isSafeInteger(options.adminIssuedAt)||options.adminIssuedAt<state.openedAt))throw Object.assign(new Error('새로 관리자 로그인한 뒤 다시 확인해 주세요.'),{code:'STALE_EPOCH'});options={...options,adminEpoch:state.epoch};payload={...payload,requestIssuedAt:Date.now()};} return await app.dispatch(payload,options); }
  catch(e){if(e.code && ['AUTH','SCOPE','REQUEST','VERSION_CONFLICT','CANCELLED','ID_REUSE','EXPIRED','CONFIG','DISABLED','MAINTENANCE','STALE_EPOCH'].includes(e.code))throw e;throw new Error('합성 저장소 연결 또는 처리 실패');}
}
export async function syntheticHttp(req,res) {
  const correlationId=randomUUID(),at=performance.now();res.setHeader('X-Synthetic-Correlation-Id',correlationId);
  try{const result=await syntheticDispatch(req.body);console.info(JSON.stringify({correlationId,stage:'synthetic-response',success:result.success===true,elapsedMs:performance.now()-at,...result.metrics}));return res.status(200).json(result);}
  catch(e){console.info(JSON.stringify({correlationId,stage:'synthetic-failure',errorKind:e.code||'UNAVAILABLE',elapsedMs:performance.now()-at}));return res.status(200).json({success:false,code:e.code||'UNAVAILABLE',message:e.code?e.message:'저장 결과를 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.',storageBackend:'transactional-synthetic'});}
}
