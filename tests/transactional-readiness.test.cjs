const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
async function setup(t){const m=await import('../transactional/store.mjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'readiness-')),db=await m.openDatabase({file:path.join(dir,'db.sqlite')});await m.initialize(db);t.after(async()=>{await db.close();fs.rmSync(dir,{recursive:true,force:true});});return {...m,db,service:m.createService(db,'x'.repeat(32))};}
test('roster removal revokes login without deleting answers; re-add restores same identity',async t=>{
 const {service,fixture,db}=await setup(t),s=fixture[0],login=await service.dispatch({action:'verifyStudent',...s});
 await service.dispatch({action:'saveProgress',studentToken:login.studentToken,studentKey:s.studentKey,requestId:randomUUID(),requestIssuedAt:Date.now(),expectedVersion:0,roleModelReason:'preserve answer'});
 const admin=p=>service.dispatch(p,{admin:true});await admin({action:'deleteRosterStudents',students:[s]});
 assert.equal((await db.query('SELECT COUNT(*) n FROM synthetic_students'))[0].n,25);
 await assert.rejects(service.dispatch({action:'verifyStudent',...s}),e=>e.code==='AUTH');await assert.rejects(service.dispatch({action:'loadProgress',studentToken:login.studentToken}),e=>e.code==='AUTH');
 await admin({action:'updateRoster',mode:'append',students:[s]});const again=await service.dispatch({action:'verifyStudent',...s});assert.equal(again.progress.roleModelReason,'preserve answer');assert.equal(again.version,3);
 await assert.rejects(service.dispatch({action:'loadProgress',studentToken:login.studentToken}),e=>e.code==='AUTH');
});
test('new roster add is idempotent; replacement archives absent answers and blocks foreign identities',async t=>{
 const {service,fixture,db}=await setup(t),admin=p=>service.dispatch(p,{admin:true}),s={studentKey:'3-1-26',grade:3,classNum:1,number:26,name:'합성학생26',googleId:'synthetic26@example.invalid'};
 await Promise.all([admin({action:'updateRoster',mode:'append',students:[s]}),admin({action:'updateRoster',mode:'append',students:[s]})]);assert.equal((await db.query('SELECT COUNT(*) n FROM synthetic_students'))[0].n,26);
 const login=await service.dispatch({action:'verifyStudent',...s});assert.equal(login.student.googleId,s.googleId);assert.ok(!JSON.stringify(login).includes(fixture[0].googleId));
 await assert.rejects(admin({action:'updateRoster',mode:'append',students:[{...fixture[0],name:'다른학생'}]}));
 await assert.rejects(admin({action:'updateRoster',mode:'replace',students:[fixture[0],fixture[0]]}));
 await admin({action:'updateRoster',mode:'replace',students:fixture});assert.equal((await admin({action:'getAdminDashboard'})).data.students.length,25);assert.equal((await db.query('SELECT COUNT(*) n FROM synthetic_students'))[0].n,26);
});
test('roster bulk failure is atomic and student cannot spoof roster activation',async t=>{
 const {service,fixture,db}=await setup(t);await db.query("CREATE TRIGGER fail_roster BEFORE UPDATE ON synthetic_students WHEN NEW.student_key='3-1-25' BEGIN SELECT RAISE(ABORT,'injected'); END");
 await assert.rejects(service.dispatch({action:'deleteRosterStudents',students:fixture},{admin:true}));assert.equal((await service.dispatch({action:'getAdminDashboard'},{admin:true})).data.students.length,25);
 const login=await service.dispatch({action:'verifyStudent',...fixture[0]});await service.dispatch({action:'saveProgress',studentToken:login.studentToken,requestId:randomUUID(),requestIssuedAt:Date.now(),expectedVersion:0,rosterActive:false});assert.notEqual((await service.read(fixture[0].studentKey)).rosterActive,false);
});
test('legacy studentKey-only Tests and owner-less submissions join strictly through roster',async()=>{
 const m=await import('../transactional/migration.mjs'),s=m.makeLegacySyntheticFixture();s.sheets.Tests=[['studentKey','test1Result','testedAt'],['03-01-01','good','2026-10-01T00:00:00Z']];s.sheets.Submissions=s.sheets.Submissions.map(r=>r.filter((_,i)=>i!==5));
 const p=m.planSyntheticMigration(s);assert.equal(JSON.parse(p.snapshot.students[0].document).test1Result,'good');s.sheets.Tests.push(['3-1-999','bad','']);assert.throws(()=>m.planSyntheticMigration(s));
});
test('Counseling restores active fields, preserves original archive and rejects ambiguous conflict',async()=>{
 const m=await import('../transactional/migration.mjs'),s=m.makeLegacySyntheticFixture();s.sheets.Counseling=[['studentKey','barrierAnswer','finalCareerReflection','completedAt'],['3-1-1','상담 보존','새 성찰','2026-10-02T00:00:00Z']];
 const p=m.planSyntheticMigration(s),d=JSON.parse(p.snapshot.students[0].document);assert.equal(d.step10.barrierAnswer,'상담 보존');assert.equal(d.step10.finalCareerReflection,'새 성찰');assert.equal(d.stepData.step10.finalCareerReflection,'새 성찰');assert.equal(d.isFinalSubmitted,true);assert.deepEqual(p.legacyArchive,s);
 s.sheets.Counseling[1][3]='';assert.throws(()=>m.planSyntheticMigration(s),/Conflicting/);
});
test('legacy owner fingerprint mismatch and missing roster are rejected without import',async()=>{
 const m=await import('../transactional/migration.mjs'),s=m.makeLegacySyntheticFixture();s.sheets.Tests=[['studentKey','ownerName'],['3-1-1','합성학생2']];assert.throws(()=>m.planSyntheticMigration(s));s.sheets.Roster.pop();assert.throws(()=>m.planSyntheticMigration(s));
});
test('backup restores added and archived roster members with post-cutover answers and receipts',async t=>{
 const {db,service,fixture,openDatabase,initialize}=await setup(t),r=await import('../transactional/recovery.mjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'restore-ready-')),target=await openDatabase({file:path.join(dir,'target.sqlite')});t.after(async()=>{await target.close();fs.rmSync(dir,{recursive:true,force:true});});await initialize(target);
 const added={studentKey:'3-1-26',grade:3,classNum:1,number:26,name:'합성학생26',googleId:'synthetic26@example.invalid'};await service.dispatch({action:'updateRoster',mode:'append',students:[added]},{admin:true});
 const auth=await service.dispatch({action:'verifyStudent',...added});await service.dispatch({action:'submitFinal',studentToken:auth.studentToken,requestId:randomUUID(),requestIssuedAt:Date.now(),expectedVersion:0,finalCareerReflection:'new answer after cutover'});await service.dispatch({action:'deleteRosterStudents',students:[fixture[0]]},{admin:true});
 const snap=await r.exportSyntheticSnapshot(db);await r.restoreSyntheticSnapshot(target,snap);assert.deepEqual(await target.query('SELECT * FROM synthetic_students ORDER BY student_key'),snap.students);assert.deepEqual(await target.query('SELECT * FROM synthetic_receipts ORDER BY student_key,request_id'),snap.receipts);await assert.rejects(r.restoreSyntheticSnapshot(target,snap));
});

test('newer Counseling wins over nested older submission while both sources stay archived',async()=>{
 const m=await import('../transactional/migration.mjs'),s=m.makeLegacySyntheticFixture();s.sheets.Submissions[0].push('step10');s.sheets.Submissions[1].push(JSON.stringify({finalCareerReflection:'old nested'}));s.sheets.Counseling=[['studentKey','finalCareerReflection','completedAt'],['3-1-1','new counseling','2026-10-03T00:00:00Z']];const p=m.planSyntheticMigration(s),d=JSON.parse(p.snapshot.students[0].document);assert.equal(d.step10.finalCareerReflection,'new counseling');assert.equal(d.stepData.step10.finalCareerReflection,'new counseling');assert.deepEqual(p.legacyArchive,s);
});

test('empty replacement excludes all logins without deleting any answer row',async t=>{
 const {service,fixture,db}=await setup(t);const result=await service.dispatch({action:'updateRoster',mode:'replace',students:[]},{admin:true});assert.equal(result.count,0);assert.equal((await db.query('SELECT COUNT(*) n FROM synthetic_students'))[0].n,25);await assert.rejects(service.dispatch({action:'verifyStudent',...fixture[0]}));await service.dispatch({action:'updateRoster',mode:'replace',students:fixture},{admin:true});assert.equal((await service.dispatch({action:'getAdminDashboard'},{admin:true})).data.students.length,25);
});
test('registered identity policy preserves full ID and canonical school key; synthetic boundary remains separate',async()=>{
 const {registeredIdentity,syntheticIdentity}=await import('../transactional/roster.mjs');const record={grade:3,classNum:2,number:25,name:'합성학생25',googleId:'synthetic25@example.invalid'};assert.equal(registeredIdentity(record).studentKey,'3-2-25');assert.equal(registeredIdentity(record).googleId,record.googleId);assert.throws(()=>syntheticIdentity(record));assert.throws(()=>registeredIdentity({...record,studentKey:'3-1-25'}));assert.throws(()=>registeredIdentity({...record,name:''}));
});
