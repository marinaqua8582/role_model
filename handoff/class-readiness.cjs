const fs=require('node:fs'),crypto=require('node:crypto');
const origin='https://staging-role-model-synthetic25-20261009.vercel.app';
const count=Number(process.argv[2]||1); if(![1,5,10,25].includes(count))throw Error('size');
const report={at:new Date().toISOString(),count,requests:[],completed:false};
async function call(body,index,stage){const at=performance.now();let r,d;try{r=await fetch(origin+'/api/gas-proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(85000)});d=await r.json();report.requests.push({student:index,stage,status:r.status,success:r.ok&&d.success===true,ms:Math.round(performance.now()-at),performance:d.performance||null,correlation:r.headers.get('x-staging-correlation-id')});if(!r.ok||!d.success)throw Error('failed '+stage+': '+String(d.message||'unknown'));return d;}catch(e){if(!d)report.requests.push({student:index,stage,status:r?.status||0,success:false,ms:Math.round(performance.now()-at),error:e.name});throw e;}}
async function wave(tasks){const results=await Promise.allSettled(tasks);const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;return results.map(r=>r.value);}
function credentials(i){return {action:'verifyStudent',grade:3,classNum:99,number:i,name:'Synthetic Student '+i,measurePerformance:true};}
function checkIdentity(d,i){if(d.student?.studentKey!==`3-99-${i}`||d.student?.googleId!==`synthetic${i}@example.invalid`||d.student?.name!==`Synthetic Student ${i}`)throw Error('synthetic identity mismatch');}
(async()=>{
try {
const roster=await call({action:'getRosterOptions'},0,'roster-guard');if(JSON.stringify(roster.data?.classesByGrade)!=='{"3":[99]}'||roster.data?.numbersByClass?.['3-99']?.length!==25)throw Error('fixture mismatch');
const ids=Array.from({length:count},(_,i)=>i+1),logins=await wave(ids.map(i=>call(credentials(i),i,'login')));logins.forEach((d,i)=>checkIdentity(d,i+1));
const markers=ids.map(i=>'synthetic_class_readiness_'+crypto.randomUUID());
const writes=ids.map((i,n)=>({action:'saveProgress',studentKey:`3-99-${i}`,studentToken:logins[n].studentToken,requestId:'readiness_'+crypto.randomUUID(),requestIssuedAt:Date.now(),roleModelReason:markers[n],measurePerformance:true}));
await wave(writes.map((p,n)=>call(p,n+1,'save')));
const again=await wave(ids.map(i=>call(credentials(i),i,'relogin')));again.forEach((d,n)=>{checkIdentity(d,n+1);if(d.progress?.roleModelReason!==markers[n])throw Error('restore mismatch');});report.restoreVerified=true;
await wave(ids.map((i,n)=>call({action:'loadProgress',studentKey:`3-99-${i}`,studentToken:again[n].studentToken,measurePerformance:true},i,'restore-api').then(d=>{if(d.data?.roleModelReason!==markers[n])throw Error('restore api mismatch');})));
const submits=ids.map((i,n)=>({action:'submitFinal',studentKey:`3-99-${i}`,studentToken:again[n].studentToken,requestId:'readiness_'+crypto.randomUUID(),requestIssuedAt:Date.now(),finalPrompt:markers[n],measurePerformance:true}));
await wave(submits.map((p,n)=>call(p,n+1,'submit')));
const final=await wave(ids.map(i=>call(credentials(i),i,'relogin-submitted')));final.forEach((d,n)=>{checkIdentity(d,n+1);if(!d.progress?.isFinalSubmitted||d.progress?.submission?.finalPrompt!==markers[n]||d.progress?.roleModelReason!==markers[n])throw Error('submitted restore mismatch');});report.submissionRestoreVerified=true;
const duplicate=await call(submits[0],1,'duplicate-submit');if(duplicate.replayed!==true)throw Error('duplicate not replayed');report.duplicateReplayVerified=true;report.completed=true;
}catch(e){report.blocker=e.message;}
finally{const output=`handoff/readiness-${count}.json`;fs.writeFileSync(output,JSON.stringify(report,null,2));const stages={};for(const r of report.requests){(stages[r.stage]||=[]).push(r);}const summaries={};for(const [k,rs] of Object.entries(stages)){const t=rs.map(r=>r.ms).sort((a,b)=>a-b);summaries[k]={success:rs.filter(r=>r.success).length,total:rs.length,meanMs:Math.round(t.reduce((a,b)=>a+b,0)/t.length),p95Ms:t[Math.ceil(t.length*.95)-1],maxMs:t.at(-1)};}console.log(JSON.stringify({completed:report.completed,blocker:report.blocker,restore:report.restoreVerified,submissionRestore:report.submissionRestoreVerified,duplicateReplay:report.duplicateReplayVerified,summaries,output}));if(!report.completed)process.exitCode=1;}
})();
