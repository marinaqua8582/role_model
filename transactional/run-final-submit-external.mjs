import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './store.mjs';
const origin=process.env.EXTERNAL_PREVIEW_ORIGIN;
if(process.env.EXTERNAL_CONFIRM!=='SYNTHETIC_25_ONLY'||!/^https:\/\/staging-role-model-synthetic25-20261009-[a-z0-9]+-jeonghee\.vercel\.app$/.test(origin||''))throw Error('Dedicated Preview required');
const config=JSON.parse(fs.readFileSync(process.env.EXTERNAL_PRIVATE_FILE,'utf8').replace(/^\uFEFF/,''));
if(decodeURIComponent(new URL(config.databaseUrl).username)!=='postgres.vanvpimargvummzqunto')throw Error('Synthetic project required');
const report={date:new Date().toISOString(),origin,environment:'external synthetic PostgreSQL Preview',completed:false,normalFailures:0,timeouts:0,phases:{}};let token;
const canon=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const stats=a=>{const s=a.toSorted((a,b)=>a-b);return {meanMs:s.reduce((a,b)=>a+b,0)/s.length,p50Ms:s[Math.ceil(s.length*.5)-1],p95Ms:s[Math.ceil(s.length*.95)-1],maxMs:s.at(-1)};};
async function request(path,body){const at=performance.now();const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok||!d.success)throw Object.assign(Error('Request rejected'),{safeCode:['AUTH','MAINTENANCE','STALE_EPOCH','VERSION_CONFLICT'].includes(d.code)?d.code:'HTTP_OR_APPLICATION'});return {data:d,ms:performance.now()-at};}
const post=p=>request('/api/gas-proxy',p);
async function wave(name,packets){const rows=await Promise.allSettled(packets.map(post)),ok=rows.filter(r=>r.status==='fulfilled').map(r=>r.value);report.phases[name]={attempts:packets.length,successes:ok.length,...stats(ok.map(r=>r.ms))};for(const r of rows)if(r.status==='rejected'){report.normalFailures++;if(['TimeoutError','AbortError'].includes(r.reason.name))report.timeouts++;}if(ok.length!==packets.length)throw Error('Phase failed');return ok;}
try{
 token=(await request('/api/admin/login',{password:config.testAdminPassword})).data.token;
 const initial=(await request('/api/admin/dashboard')).data.data.students;
 assert.equal(initial.length,25);assert.ok(initial.every(s=>fixture.some(f=>Object.keys(f).every(k=>s[k]===f[k]))));
 const logins=await wave('loginPreparation',fixture.map(s=>({action:'verifyStudent',...s})));const run=randomUUID();
 const packets=logins.map((r,i)=>({action:'submitFinal',studentKey:fixture[i].studentKey,studentToken:r.data.studentToken,expectedVersion:r.data.version,requestId:randomUUID(),requestIssuedAt:Date.now(),gemUrl:'https://gemini.google.com/gem/synthetic-final-'+i,barrierAnswer:`${run}-${i}-barrier`,barrierReflection:`${run}-${i}-barrier-reflection`,decisionAnswer:`${run}-${i}-decision`,decisionReflection:`${run}-${i}-decision-reflection`,educationAnswer:`${run}-${i}-education`,educationReflection:`${run}-${i}-education-reflection`,finalCareerReflection:`${run}-${i}-합성 최종 제출 동시 저장 검증을 위한 성찰 기록입니다. 실제 학생 자료가 아닙니다.`}));
 const finals=await wave('simultaneousFinalSubmit25',packets);
 if(report.phases.simultaneousFinalSubmit25.p95Ms>5000||report.phases.simultaneousFinalSubmit25.maxMs>10000)throw Object.assign(Error('Performance target exceeded'),{safeCode:'PERFORMANCE_TARGET'});
 const status=await wave('receiptRead',packets.map(p=>({action:'getSaveStatus',studentToken:p.studentToken,requestId:p.requestId})));
 status.forEach(r=>assert.equal(r.data.state,'completed'));
 const replay=await wave('sameRequestReplay',packets);replay.forEach((r,i)=>{assert.equal(r.data.replayed,true);assert.equal(r.data.version,finals[i].data.version);});
 const restored=await wave('reloginRestore',fixture.map(s=>({action:'verifyStudent',...s}))),admin=(await request('/api/admin/dashboard')).data.data.students;
 assert.equal(admin.length,25);assert.equal(new Set(admin.map(s=>s.studentKey)).size,25);
 restored.forEach((r,i)=>{const p=r.data.progress;assert.equal(p.isFinalSubmitted,true);for(const k of ['gemUrl','barrierAnswer','barrierReflection','decisionAnswer','decisionReflection','educationAnswer','educationReflection','finalCareerReflection'])assert.equal(p.step10[k],packets[i][k]);assert.equal(canon(p),canon(admin.find(s=>s.studentKey===fixture[i].studentKey)));fixture.forEach((f,j)=>{if(i!==j)assert.ok(!JSON.stringify(r.data).includes(f.googleId));});});
 report.completed=true;report.submittedAndReceiptsMatched=25;report.studentAdminMatched=25;report.duplicateStudentRows=0;report.replayExtraVersions=0;report.wrongStudentUpdates=0;report.privacyLeaks=0;
 report.serverMetrics=Object.fromEntries(['poolWaitMs','lockWaitMs','lockHeldMs','dbReadMs','dbWriteMs','commitMs','totalMs'].map(k=>[k,stats(finals.map(r=>r.data.metrics?.[k]).filter(Number.isFinite))]));
}catch(e){report.errorKind=e.safeCode||e.name;process.exitCode=1;}
finally{fs.writeFileSync('verification/final-submit-external-25-2026-10-17.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
