const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {client}=require('../tests/mock-client.cjs');
const origin='https://staging-role-model-synthetic25-20261009.vercel.app',report={at:new Date().toISOString(),completed:false,requests:[]};
async function call(body){const at=performance.now();const r=await fetch(origin+'/api/gas-proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(85000)});const d=await r.json();report.requests.push({stage:body.action,status:r.status,success:d.success===true,ms:Math.round(performance.now()-at)});return d;}
function creds(i){return {action:'verifyStudent',grade:3,classNum:99,number:i,name:'Synthetic Student '+i};}
function identity(d,i){assert.equal(d.success,true);assert.equal(d.student.studentKey,`3-99-${i}`);assert.equal(d.student.googleId,`synthetic${i}@example.invalid`);const ids=JSON.stringify(d).match(/synthetic\d+@example\.invalid/g)||[];assert.ok(ids.every(x=>x===`synthetic${i}@example.invalid`));}
(async()=>{try{
const a=await call(creds(1)),b=await call(creds(2));identity(a,1);identity(b,2);const bReason=b.progress.roleModelReason;
const before=await call({action:'loadProgress',studentKey:'3-99-2',studentToken:a.studentToken});assert.equal(before.success,false);assert.equal(before.data,undefined);report.foreignStudentReadBlocked=true;
const state={apiCalls:0};let drop=false,writes=0;
const api=client(origin,state,async(url,options)=>{const body=JSON.parse(options.body);if(body.action==='saveProgress')writes++;const response=await fetch(url,options);if(body.action==='saveProgress'&&drop){await response.arrayBuffer();drop=false;throw new TypeError('Synthetic response loss');}return response;});
const login=await api.verifyStudentAuth({grade:3,classNum:99,number:1,name:'Synthetic Student 1'});assert.equal(login.success,true);
const marker='synthetic_loss_'+crypto.randomUUID();drop=true;
const payload={action:'saveProgress',studentKey:'3-99-1',roleModelReason:marker};
await assert.rejects(()=>api.callGasApi(payload));assert.equal(api.hasUncertainSave('3-99-1'),true);await assert.rejects(()=>api.callGasApi(payload));assert.equal(writes,1);
const result=await api.confirmPendingSave();assert.equal(result.state,'completed');assert.equal(api.hasUncertainSave('3-99-1'),false);report.responseLoss={automaticResaves:0,writeCalls:writes,confirmed:'completed',failureStateShown:true};
const requestId='cancelled_'+crypto.randomUUID(),requestIssuedAt=Date.now();
const cancelled=await call({action:'getSaveStatus',studentKey:'3-99-1',studentToken:a.studentToken,requestId,requestIssuedAt});assert.equal(cancelled.state,'cancelled');
const late=await call({action:'saveProgress',studentKey:'3-99-1',studentToken:a.studentToken,requestId,requestIssuedAt,roleModelReason:'must_not_apply'});assert.equal(late.success,false);
const restored=await call(creds(1));identity(restored,1);assert.equal(restored.progress.roleModelReason,marker);assert.equal(restored.progress.isFinalSubmitted,true);report.cancelledLateWriteBlocked=true;
const other=await call(creds(2));identity(other,2);assert.equal(other.progress.roleModelReason,bReason);report.otherStudentUnchanged=true;
report.completed=true;
}catch(e){report.blocker=e.message;}finally{fs.writeFileSync('handoff/readiness-safety.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.completed)process.exitCode=1;}})();
