import {fixture} from './store.mjs';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const origin=process.env.TRANSACTIONAL_STAGING_URL;
if(process.env.TRANSACTIONAL_STAGING_CONFIRM!=='SYNTHETIC_25_ONLY'||!origin||!/^https:\/\/staging-role-model-synthetic25-20261009-[a-z0-9]+-jeonghee\.vercel\.app$/.test(origin)||!process.env.TRANSACTIONAL_TEST_ADMIN_PASSWORD)throw Error('Explicit synthetic Preview URL, confirmation and private test administrator password required');
const report={environment:'remote synthetic transactional preview',phases:{},failures:0,timeouts:0,completed:false};
let adminToken;
const request=async(path,p)=>{
  const at=performance.now();const response=await fetch(origin+path,{method:p?'POST':'GET',headers:{'Content-Type':'application/json',...(adminToken?{Authorization:'Bearer '+adminToken}:{})},body:p?JSON.stringify(p):undefined,redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('HTTP failure');const data=await response.json();if(!data.success)throw Error('Request rejected');return {data,ms:performance.now()-at};
};
const stats=arr=>{const s=arr.slice().sort((a,b)=>a-b);return {meanMs:s.reduce((a,b)=>a+b,0)/s.length,p50Ms:s[Math.ceil(s.length*.5)-1],p95Ms:s[Math.ceil(s.length*.95)-1],maxMs:s.at(-1)};};
const check=(value)=>{if(!value)throw Error('Synthetic consistency check failed');};
try {
  const probe=(await request('/api/gas-proxy',{action:'getRosterOptions'})).data;check(probe.storageBackend==='transactional-synthetic');
  adminToken=(await request('/api/admin/login',{password:process.env.TRANSACTIONAL_TEST_ADMIN_PASSWORD})).data.token;
  const before=(await request('/api/admin/dashboard')).data.data.students;check(before.length===25&&before.every(s=>fixture.some(f=>f.studentKey===s.studentKey&&f.googleId===s.googleId)));
  const login=await Promise.all(fixture.map(s=>request('/api/gas-proxy',{action:'verifyStudent',...s})));report.phases.login=stats(login.map(r=>r.ms));
  const sessions=login.map((r,i)=>{check(r.data.student.googleId===fixture[i].googleId);fixture.forEach((s,j)=>{if(i!==j)check(!JSON.stringify(r.data).includes(s.googleId));});return {key:fixture[i].studentKey,token:r.data.studentToken,version:r.data.version};});
  const metrics=[];const run=randomUUID();let last=[];
  async function wave(label,action,input){const results=await Promise.all(sessions.map(async(s,i)=>{const packet={action,studentKey:s.key,studentToken:s.token,expectedVersion:s.version,requestId:randomUUID(),requestIssuedAt:Date.now(),...input(i)};const r=await request('/api/gas-proxy',packet);s.version=r.data.version;metrics.push(r.data.metrics);last[i]=packet;return r;}));report.phases[label]=stats(results.map(r=>r.ms));check(report.phases[label].p95Ms<=5000&&report.phases[label].maxMs<=10000);}
  await wave('progressSave','saveProgress',i=>({roleModelReason:`${run}-${i}`,stepData:{step1:{roleModelReason:`${run}-${i}`}}}));
  await wave('progressUpdate','saveProgress',i=>({roleModelName:`모형${i}`}));
  await wave('testsSave','saveTests',i=>({step8:{tests:{test1:{result:'good',note:`${run}-${i}`}}}}));
  await wave('testsUpdate','saveTests',i=>({problemDescription:`${run}-${i}`}));
  await wave('finalSubmit','submitFinal',i=>({gemUrl:'https://example.invalid/'+i,finalCareerReflection:`${run}-${i}`}));
  await wave('finalUpdate','submitFinal',i=>({finalCareerReflection:`${run}-${i}`}));
  const duplicate=await Promise.all(last.map(p=>request('/api/gas-proxy',p)));duplicate.forEach((r,i)=>check(r.data.version===sessions[i].version&&r.data.replayed));
  const s=sessions[0],cancelId=randomUUID();check((await request('/api/gas-proxy',{action:'cancelSave',studentToken:s.token,studentKey:s.key,requestId:cancelId})).data.state==='cancelled');
  const cancelled=await fetch(origin+'/api/gas-proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'saveProgress',studentToken:s.token,studentKey:s.key,requestId:cancelId,requestIssuedAt:Date.now(),expectedVersion:s.version,roleModelName:'반영금지'}),signal:AbortSignal.timeout(10000)});check((await cancelled.json()).code==='CANCELLED');
  // Discard a replay response; status query never sends another write.
  await request('/api/gas-proxy',last[1]);const status=(await request('/api/gas-proxy',{action:'getSaveStatus',studentToken:sessions[1].token,studentKey:sessions[1].key,requestId:last[1].requestId})).data;check(status.state==='completed');
  const restored=await Promise.all(fixture.map(f=>request('/api/gas-proxy',{action:'verifyStudent',...f})));report.phases.relogin=stats(restored.map(r=>r.ms));
  const admin=(await request('/api/admin/dashboard')).data.data.students;check(admin.length===25&&new Set(admin.map(s=>s.studentKey)).size===25);
  restored.forEach((r,i)=>{const p=r.data.progress,a=admin.find(s=>s.studentKey===fixture[i].studentKey);check(p.roleModelReason===`${run}-${i}`&&p.finalCareerReflection===`${run}-${i}`&&p.isFinalSubmitted&&p.step8.tests.test1.note===`${run}-${i}`&&JSON.stringify(p)===JSON.stringify(a));});
  report.metrics=Object.fromEntries(['poolWaitMs','lockWaitMs','lockHeldMs','dbReadMs','dbWriteMs','commitMs','totalMs'].map(k=>[k,stats(metrics.map(m=>m[k]))]));
  check(Object.values(report.phases).every(s=>s.p95Ms<=5000&&s.maxMs<=10000));
  report.completed=true;report.duplicates=0;report.wrongStudentUpdates=0;report.privacyLeaks=0;report.scope='API test only; real browser UI and network fault injection require separate validation';
}catch(e){report.failures++;if(e.name==='TimeoutError'||e.name==='AbortError')report.timeouts++;report.errorKind=e.name||'Error';process.exitCode=1;}
writeFileSync('verification/transactional-remote-25.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({completed:report.completed,failures:report.failures,timeouts:report.timeouts}));
