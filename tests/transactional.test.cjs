const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync,writeFileSync,mkdirSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {randomBytes,randomUUID}=require('node:crypto');
const {execFileSync}=require('node:child_process');

test('durable synthetic HTTP: 25 login/save/restore/final/admin and failure safety',async t=>{
  const {startLocal}=await import('../transactional/local-server.mjs');
  const {fixture,assertSyntheticEnvironment,cleanupExpired}=await import('../transactional/store.mjs');
  const dir=mkdtempSync(path.join(tmpdir(),'role-model-synthetic-')),file=path.join(dir,'test.sqlite'),secret=randomBytes(32).toString('hex');
  let app=await startLocal({file,secret});t.after(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
  const report={environment:'local disk SQLite + real HTTP, NOT staging/PostgreSQL',users:25,phases:{},failures:0,timeouts:0,duplicateRows:0,wrongStudentUpdates:0,privacyLeaks:0,metrics:[]};
  const request=async(p,admin=false)=>{const at=performance.now();const res=await fetch(app.url+(admin?'/api/synthetic-admin':'/api/gas-proxy'),{method:'POST',headers:{'Content-Type':'application/json',...(admin?{Authorization:'Bearer '+app.adminSecret}:{})},body:JSON.stringify(p),signal:AbortSignal.timeout(10000)});const data=await res.json();return {data,ms:performance.now()-at};};
  const stats=values=>{const s=values.slice().sort((a,b)=>a-b);return {meanMs:s.reduce((a,b)=>a+b,0)/s.length,p50Ms:s[Math.ceil(s.length*.5)-1],p95Ms:s[Math.ceil(s.length*.95)-1],maxMs:s.at(-1)};};
  let sessions=[];
  await t.test('25 simultaneous logins expose only own full Google ID; invalid identity blocked',async()=>{
    const result=await Promise.all(fixture.map(s=>request({action:'verifyStudent',...s})));
    sessions=result.map(({data},i)=>{assert.equal(data.success,true);assert.equal(data.student.googleId,fixture[i].googleId);for(const other of fixture.filter(s=>s!==fixture[i]))assert.ok(!JSON.stringify(data).includes(other.googleId));return {token:data.studentToken,version:data.version,key:fixture[i].studentKey};});
    report.phases.login=stats(result.map(r=>r.ms));
    assert.equal((await request({action:'verifyStudent',...fixture[0],name:'틀린이름'})).data.code,'AUTH');
  });
  const packets=new Map();
  async function wave(label,action,make) {
    const results=await Promise.all(sessions.map(async(s,i)=>{const p={action,studentKey:s.key,studentToken:s.token,requestId:randomUUID(),requestIssuedAt:Date.now(),expectedVersion:s.version,...make(i)};packets.set(label+':'+i,p);const r=await request(p);assert.equal(r.data.success,true,JSON.stringify(r.data));s.version=r.data.version;report.metrics.push(r.data.metrics);return r;}));report.phases[label]=stats(results.map(r=>r.ms));
  }
  await t.test('25 new progress rows and existing updates are durably acknowledged',async()=>{
    await wave('progressNew','saveProgress',i=>({currentStep:2,roleModelName:`모형${i}`,stepData:{step1:{roleModelName:`모형${i}`}}}));
    await wave('progressUpdate','saveProgress',i=>({currentStep:3,roleModelReason:`이유${i}`}));
  });
  await t.test('25 new/existing Tests and final Submissions use same atomic document',async()=>{
    await wave('testsNew','saveTests',i=>({step8:{tests:{test1:{result:'good',note:`합성${i}`}}},problemDescription:`문제${i}`}));
    await wave('testsUpdate','saveTests',i=>({step8:{tests:{test1:{result:'good',note:`수정${i}`}}}}));
    await wave('finalNew','submitFinal',i=>({gemUrl:'https://example.invalid/'+i,finalCareerReflection:`최종${i}`}));
    await wave('finalUpdate','submitFinal',i=>({gemUrl:'https://example.invalid/'+i,finalCareerReflection:`최종수정${i}`}));
  });
  await t.test('same ID concurrent duplicate is replayed once; different payload reuse rejected',async()=>{
    const s=sessions[0],p={action:'saveProgress',studentKey:s.key,studentToken:s.token,requestId:randomUUID(),requestIssuedAt:Date.now(),expectedVersion:s.version,roleModelReason:'중복검증'};
    const r=await Promise.all(Array.from({length:10},()=>request(p)));r.forEach(x=>assert.equal(x.data.success,true));assert.equal(new Set(r.map(x=>x.data.version)).size,1);s.version=r[0].data.version;
    assert.equal((await request({...p,roleModelReason:'위조'})).data.code,'ID_REUSE');
  });
  await t.test('stale screen and simultaneous different IDs never overwrite newer version',async()=>{
    const s=sessions[1],p={action:'saveProgress',studentKey:s.key,studentToken:s.token,requestIssuedAt:Date.now(),expectedVersion:s.version,roleModelReason:'버전검증'};
    const results=await Promise.all([request({...p,requestId:randomUUID()}),request({...p,requestId:randomUUID()})]);assert.equal(results.filter(r=>r.data.success).length,1);assert.equal(results.filter(r=>r.data.code==='VERSION_CONFLICT').length,1);s.version++;
  });
  await t.test('cancel tombstone blocks delayed save; committed save cannot become cancelled',async()=>{
    const s=sessions[2],id=randomUUID();assert.equal((await request({action:'cancelSave',studentToken:s.token,studentKey:s.key,requestId:id})).data.state,'cancelled');
    assert.equal((await request({action:'saveProgress',studentToken:s.token,studentKey:s.key,requestId:id,requestIssuedAt:Date.now(),expectedVersion:s.version,roleModelReason:'반영금지'})).data.code,'CANCELLED');
    const old=packets.get('finalUpdate:2');assert.equal((await request({...old,action:'cancelSave'})).data.state,'completed');
  });
  await t.test('lost response: discard acknowledged body, query receipt only, no save resend',async()=>{
    const s=sessions[3],p={action:'saveProgress',studentToken:s.token,studentKey:s.key,requestId:randomUUID(),requestIssuedAt:Date.now(),expectedVersion:s.version,roleModelReason:'응답유실'};
    await request(p); // deliberately discard response; exactly one write request
    const r=(await request({action:'getSaveStatus',studentToken:s.token,studentKey:s.key,requestId:p.requestId})).data;assert.equal(r.state,'completed');assert.equal(r.result.version,s.version+1);s.version++;
    const rows=await app.db.query('SELECT request_id FROM synthetic_receipts WHERE student_key=? AND request_id=?',[s.key,p.requestId]);assert.equal(rows.length,1);
  });
  await t.test('foreign student, forged token and expired request blocked',async()=>{
    const s=sessions[0];assert.equal((await request({action:'loadProgress',studentToken:s.token,studentKey:sessions[1].key})).data.code,'SCOPE');
    assert.equal((await request({action:'loadProgress',studentToken:s.token+'x'})).data.code,'AUTH');
    assert.equal((await request({action:'saveProgress',studentToken:s.token,studentKey:s.key,requestId:randomUUID(),requestIssuedAt:1,expectedVersion:s.version})).data.code,'EXPIRED');
    assert.throws(()=>assertSyntheticEnvironment({TRANSACTIONAL_SYNTHETIC:'synthetic-only-25',TRANSACTIONAL_SESSION_SECRET:secret,VERCEL_ENV:'production'}));
  });
  await t.test('transaction rollback preserves document and receipt together',async()=>{
    const before=await app.service.read(sessions[4].key);
    await assert.rejects(app.db.transaction(sessions[4].key,async q=>{await q('UPDATE synthetic_students SET version=999 WHERE student_key=?',[sessions[4].key]);throw Error('injected failure');}));
    assert.deepEqual(await app.service.read(sessions[4].key),before);
    await app.db.query("CREATE TRIGGER synthetic_fail BEFORE INSERT ON synthetic_receipts WHEN NEW.request_id='injected_failure' BEGIN SELECT RAISE(ABORT,'injected'); END");
    const s=sessions[4];assert.equal((await request({action:'saveProgress',studentToken:s.token,studentKey:s.key,requestId:'injected_failure',requestIssuedAt:Date.now(),expectedVersion:s.version,roleModelReason:'반영금지'})).data.success,false);
    assert.deepEqual(await app.service.read(s.key),before);await app.db.query('DROP TRIGGER synthetic_fail');
  });
  await t.test('expired receipt cleanup protects unknown/pending and runs under student transaction',async()=>{
    const key=sessions[5].key;
    for(const state of ['completed','cancelled','pending','unknown','processing'])await app.db.query('INSERT INTO synthetic_receipts(student_key,request_id,state,expires_at) VALUES(?,?,?,?)',[key,'cleanup_'+state,state,1]);
    const result=await cleanupExpired(app.db);assert.equal(result.deleted,2);
    const states=await app.db.query('SELECT state FROM synthetic_receipts WHERE student_key=? AND expires_at=1',[key]);assert.deepEqual(states.map(s=>s.state).sort(),['pending','processing','unknown']);
  });
  await t.test('new process reads committed answers; reopen restores login/final/admin exactly',async()=>{
    const moduleUrl=new URL('../transactional/store.mjs',require('node:url').pathToFileURL(__filename)).href;
    const count=execFileSync(process.execPath,['--input-type=module','-e',`import {openDatabase} from ${JSON.stringify(moduleUrl)};const d=await openDatabase({file:process.argv[1]});const r=await d.query('SELECT document FROM synthetic_students');if(r.length!==25||r.some(x=>!JSON.parse(x.document).isFinalSubmitted))process.exit(2);console.log(r.length);await d.close();`,file],{encoding:'utf8',stdio:['ignore','pipe','pipe']});assert.equal(count.trim(),'25');
    await app.close();app=await startLocal({file,secret});
    const results=await Promise.all(fixture.map(s=>request({action:'verifyStudent',...s})));report.phases.relogin=stats(results.map(r=>r.ms));
    const admin=(await request({action:'getAdminDashboard'},true)).data;assert.equal(admin.data.students.length,25);
    results.forEach(({data},i)=>{assert.equal(data.progress.finalCareerReflection,`최종수정${i}`);assert.equal(data.progress.step8.tests.test1.note,`수정${i}`);assert.equal(data.progress.roleModelName,`모형${i}`);assert.equal(data.progress.isFinalSubmitted,true);assert.deepEqual(admin.data.students[i],data.progress);});
    assert.equal((await fetch(app.url+'/api/synthetic-admin',{method:'POST',body:'{}'})).status,403);
    const duplicates=await app.db.query('SELECT student_key,COUNT(*) n FROM synthetic_students GROUP BY student_key HAVING COUNT(*)>1');assert.equal(duplicates.length,0);
    const rows=await app.db.query('SELECT identity FROM synthetic_students');assert.equal(rows.length,25);rows.forEach(r=>assert.ok(JSON.parse(r.identity).googleId.endsWith('@example.invalid')));
  });
  report.latencyTargetMetLocally=Object.values(report.phases).every(s=>s.p95Ms<=5000&&s.maxMs<=10000);
  report.transactionMetrics=Object.fromEntries(['poolWaitMs','lockWaitMs','lockHeldMs','dbReadMs','dbWriteMs','commitMs','totalMs'].map(k=>[k,stats(report.metrics.map(m=>m[k]))]));delete report.metrics;
  report.responseLossTest='One completed write response intentionally discarded; receipt read only. Network fault/UI end-to-end remains unverified.';
  mkdirSync(path.join(__dirname,'../verification'),{recursive:true});writeFileSync(path.join(__dirname,'../verification/transactional-local-25'+(process.env.VERCEL?'-vercel-build':'')+'.json'),JSON.stringify(report,null,2)+'\n');
  assert.equal(report.latencyTargetMetLocally,true);
});
