import {randomUUID} from 'node:crypto';
import {createRegisteredService} from './store.mjs';

const adminActions=new Set(['checkAdminConfig','getAdminDashboard','getStudentDetail','updateRoster','deleteRosterStudents']);
const rosterWrites=new Set(['updateRoster','deleteRosterStudents']);
// Dependency-injected server adapter. No environment switch enables production, no browser DB credentials.
// authorizeAdmin must verify the existing server HMAC/cookie and return its signed issuance time.
export async function createRegisteredHttp({db,sessionSecret,authorizeAdmin}) {
  const app=await createRegisteredService(db,sessionSecret);
  return async(req,res)=>{
    const correlationId=randomUUID();res.setHeader('Cache-Control','no-store');res.setHeader('X-Correlation-Id',correlationId);
    if(req.method!=='POST')return res.status(405).json({success:false,code:'METHOD'});
    try {
      const p=req.body||{};let options={};
      if(adminActions.has(p.action)){
        const auth=await authorizeAdmin(req);
        if(!auth?.valid) return res.status(401).json({success:false,code:'AUTH'});
        const state=await app.maintenanceStatus();
        if(rosterWrites.has(p.action)&&state.epoch>0&&(!Number.isSafeInteger(auth.issuedAt)||auth.issuedAt<state.openedAt))throw Object.assign(Error(),{code:'STALE_EPOCH'});
        options={admin:true,adminEpoch:state.epoch};
      }
      const result=await app.dispatch({...p,...(rosterWrites.has(p.action)?{requestIssuedAt:Date.now()}: {})},options);
      return res.status(200).json(result);
    }catch(e){return res.status(200).json({success:false,code:['AUTH','SCOPE','REQUEST','VERSION_CONFLICT','CANCELLED','ID_REUSE','EXPIRED','MAINTENANCE','STALE_EPOCH'].includes(e.code)?e.code:'UNAVAILABLE',message:'서버 요청을 확인하지 못했습니다. 입력 내용을 보관하고 상태를 확인해 주세요.'});}
  };
}
