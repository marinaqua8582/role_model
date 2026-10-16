import {readFileSync,writeFileSync} from 'node:fs';
import {createHmac,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {openDatabase,verifyInitialized,fixture} from './store.mjs';
import {setMaintenance,maintenanceStatus} from './maintenance.mjs';
const config=JSON.parse(readFileSync(process.env.EXTERNAL_PRIVATE_FILE,'utf8'));
const auth=JSON.parse(readFileSync(process.env.GAS_PRIVATE_FILE,'utf8'));
const origin=process.env.EXTERNAL_PREVIEW_ORIGIN,schema=process.env.EXTERNAL_REHEARSAL_SCHEMA;
if(process.env.EXTERNAL_CONFIRM!=='SYNTHETIC_25_ONLY'||!/^https:\/\/staging-role-model-synthetic25-20261009-[a-z0-9]+-jeonghee\.vercel\.app$/.test(origin)||!/^role_model_synthetic_rehearsal_cutover_[a-z0-9]+$/.test(schema)||decodeURIComponent(new URL(config.databaseUrl).username)!=='postgres.vanvpimargvummzqunto')throw Error('Synthetic boundary required');
const db=await openDatabase({url:config.databaseUrl,schema});await verifyInitialized(db,{registered:true,identities:fixture});
const report={date:'2026-10-15',environment:'actual Vercel Preview and Seoul Supabase registered-policy rehearsal',origin,phases:{},failures:0,timeouts:0,completed:false};
let adminToken;const timings=[];
const stats=a=>{const s=a.toSorted((a,b)=>a-b);return {meanMs:s.reduce((a,b)=>a+b,0)/s.length,p50Ms:s[Math.ceil(s.length*.5)-1],p95Ms:s[Math.ceil(s.length*.95)-1],maxMs:s.at(-1)};};
async function req(path,p,{expected=false}={}){const at=performance.now();try{const r=await fetch(origin+path,{method:p?'POST':'GET',headers:{'Content-Type':'application/json',...(adminToken?{Authorization:'Bearer '+adminToken}:{})},body:p?JSON.stringify(p):undefined,redirect:'error',signal:AbortSignal.timeout(10000)});const data=await r.json();if(!r.ok||!expected&&!data.success)throw Object.assign(Error('rejected'),{code:data.code||'HTTP',correlationId:r.headers.get('x-synthetic-correlation-id')});return {data,ms:performance.now()-at};}catch(e){if(!expected){report.failures++;if(['AbortError','TimeoutError'].includes(e.name))report.timeouts++;report.failure={errorKind:e.name,code:e.code||'NETWORK',correlationId:e.correlationId||undefined};}throw e;}}
const post=p=>req('/api/gas-proxy',p);
async function wave(label,packets){const rows=await Promise.allSettled(packets.map(post));const successful=rows.filter(r=>r.status==='fulfilled').map(r=>r.value);report.phases[label]={...stats(successful.map(r=>r.ms)),attempts:packets.length,successes:successful.length};if(successful.length!==packets.length)throw Error('phase failed');if(report.phases[label].p95Ms>5000||report.phases[label].maxMs>10000)throw Object.assign(Error('target exceeded'),{code:'PERFORMANCE_TARGET'});return successful;}
try{
  await setMaintenance(db,false);
  const probe=(await post({action:'getRosterOptions'})).data;assert.equal(probe.storageBackend,'transactional-synthetic');
  adminToken=(await req('/api/admin/login',{password:config.testAdminPassword})).data.token;
  const [body,sig]=adminToken.split('.');assert.equal(createHmac('sha256',`${config.testAdminPassword}::${auth.admin}::rolemodel_session_salt_2026`).update(body).digest('base64url'),sig);report.previewAdminSecretMatchesPrivateGasSecret=true;
  const initial=(await req('/api/admin/dashboard')).data.data.students;assert.equal(initial.length,25);initial.forEach(s=>assert.ok(fixture.some(f=>Object.keys(f).every(k=>s[k]===f[k]))));
  const warm=(await post({action:'verifyStudent',...fixture[0]})).data;assert.equal(warm.success,true);
  const logins=await wave('login',fixture.map(s=>({action:'verifyStudent',...s})));const sessions=logins.map((r,i)=>{assert.equal(r.data.student.googleId,fixture[i].googleId);fixture.forEach((s,j)=>{if(i!==j)assert.ok(!JSON.stringify(r.data).includes(s.googleId));});return {key:fixture[i].studentKey,token:r.data.studentToken,version:r.data.version};});
  const run=randomUUID();let last=[];
  for(const [label,action,fields] of [
    ['progressSave','saveProgress',i=>({roleModelReason:`${run}-${i}`,stepData:{step1:{roleModelReason:`${run}-${i}`}}})],
    ['progressUpdate','saveProgress',i=>({roleModelName:`모형${i}`})],
    ['testsSave','saveTests',i=>({step8:{tests:{test1:{note:`${run}-${i}`,result:'good'}}}})],
    ['finalSubmit','submitFinal',i=>({finalCareerReflection:`${run}-${i}`,gemUrl:'https://example.invalid/'+i})]
  ]){last=sessions.map((s,i)=>({action,studentKey:s.key,studentToken:s.token,expectedVersion:s.version,requestId:randomUUID(),requestIssuedAt:Date.now(),...fields(i)}));const results=await wave(label,last);results.forEach((r,i)=>{sessions[i].version=r.data.version;timings.push(r.data.metrics);});}
  const duplicate=await Promise.all(last.map(post));duplicate.forEach((r,i)=>{assert.equal(r.data.replayed,true);assert.equal(r.data.version,sessions[i].version);});report.duplicateRows=0;
  const restored=await wave('reloginRestore',fixture.map(s=>({action:'verifyStudent',...s})));const admin=(await req('/api/admin/dashboard')).data.data.students;
  const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;const canon=x=>JSON.stringify(canonical(x));restored.forEach((r,i)=>{assert.equal(r.data.progress.roleModelReason,`${run}-${i}`);assert.equal(r.data.progress.finalCareerReflection,`${run}-${i}`);assert.equal(r.data.progress.step8.tests.test1.note,`${run}-${i}`);assert.equal(r.data.progress.isFinalSubmitted,true);assert.equal(canon(r.data.progress),canon(admin.find(s=>s.studentKey===fixture[i].studentKey)));});report.studentAdminMatch=true;report.wrongStudentUpdates=0;report.privacyLeaks=0;
  const s=restored[0].data,p={action:'saveProgress',studentToken:s.studentToken,expectedVersion:s.version,studentKey:fixture[0].studentKey,requestId:randomUUID(),requestIssuedAt:Date.now(),roleModelReason:`${run}-0`};
  let admitted,release;const started=new Promise(r=>admitted=r),hold=new Promise(r=>release=r);
  const held=db.transaction(fixture[0].studentKey,async()=>{admitted();await hold;return {};});await started;
  const inFlight=post(p);let observed=false;
  for(let i=0;i<30;i++){const r=await db.query("SELECT COUNT(*) n FROM pg_locks WHERE locktype='advisory' AND classid=174014 AND objid=1 AND mode='ShareLock' AND granted");if(Number(r[0].n)>0){observed=true;break;}await new Promise(r=>setTimeout(r,100));}
  if(!observed){release();await held;await inFlight;throw Error('Admitted writer not observed');}
  let returned=false;const closing=setMaintenance(db,true).then(r=>{returned=true;return r;});await new Promise(r=>setTimeout(r,150));assert.equal(returned,false);release();await held;assert.equal((await inFlight).data.success,true);await closing;report.inFlightPreviewWriteDrained=true;
  const before=await db.query('SELECT student_key,document,version FROM synthetic_students ORDER BY student_key');
  const blocked=(await req('/api/gas-proxy',{...p,requestId:randomUUID()},{expected:true})).data;assert.equal(blocked.code,'MAINTENANCE');
  assert.equal((await post({action:'getSaveStatus',studentToken:s.studentToken,requestId:p.requestId})).data.state,'completed');assert.ok((await req('/api/admin/dashboard')).data.success);assert.deepEqual(await db.query('SELECT student_key,document,version FROM synthetic_students ORDER BY student_key'),before);report.frozenReadStatusAndWrites=true;
  await setMaintenance(db,false);const stale=(await req('/api/gas-proxy',{...p,requestId:randomUUID(),requestIssuedAt:Date.now()},{expected:true})).data;assert.equal(stale.code,'STALE_EPOCH');report.oldSessionBlocked=true;
  const fresh=(await post({action:'verifyStudent',...fixture[0]})).data;const cancelId=randomUUID();await post({action:'cancelSave',studentToken:fresh.studentToken,requestId:cancelId,requestIssuedAt:Date.now()});const cancelled=(await req('/api/gas-proxy',{...p,studentToken:fresh.studentToken,expectedVersion:fresh.version,requestId:cancelId,requestIssuedAt:Date.now()},{expected:true})).data;assert.equal(cancelled.code,'CANCELLED');report.cancelledDelayedWriteBlocked=true;
  const final=(await post({action:'verifyStudent',...fixture[0]})).data;assert.equal(final.progress.isFinalSubmitted,true);assert.equal((await db.query('SELECT state FROM synthetic_receipts WHERE student_key=? AND request_id=?',[fixture[0].studentKey,p.requestId]))[0].state,'completed');report.finalAndReceiptRetained=true;
  report.metrics=Object.fromEntries(['poolWaitMs','lockWaitMs','lockHeldMs','dbReadMs','dbWriteMs','commitMs','totalMs'].map(k=>[k,stats(timings.map(m=>m[k]))]));report.completed=true;
}catch(e){report.errorKind=e.code||e.name;process.exitCode=1;}
finally{report.finalMaintenance=await maintenanceStatus(db);await db.close();writeFileSync('verification/registered-external-25.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({completed:report.completed,failures:report.failures,timeouts:report.timeouts,errorKind:report.errorKind,phases:report.phases}));}
