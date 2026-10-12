const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('synthetic private recovery preserves latest answers/versions/receipts and refuses overwrite',async()=>{
  const {openDatabase,initialize,createService,fixture}=await import('../transactional/store.mjs');const {exportSyntheticSnapshot,restoreSyntheticSnapshot}=await import('../transactional/recovery.mjs');
  const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'role-recovery-'));const a=await openDatabase({file:path.join(dir,'a.sqlite')}),b=await openDatabase({file:path.join(dir,'b.sqlite')});
  try{await initialize(a);await initialize(b);const service=createService(a,'s'.repeat(32)),auth=await service.dispatch({action:'verifyStudent',...fixture[0]});const p={action:'saveProgress',studentToken:auth.studentToken,studentKey:fixture[0].studentKey,requestId:'recovery_request',requestIssuedAt:Date.now(),expectedVersion:0,roleModelName:'전환후새답안',stepData:{step1:{competencyCustom:'기존호환직접입력'}}};assert.equal((await service.dispatch(p)).success,true);
    const snapshot=await exportSyntheticSnapshot(a);await restoreSyntheticSnapshot(b,snapshot);assert.deepEqual(await a.query('SELECT document,version FROM synthetic_students ORDER BY student_key'),await b.query('SELECT document,version FROM synthetic_students ORDER BY student_key'));assert.deepEqual(await a.query('SELECT * FROM synthetic_receipts'),await b.query('SELECT * FROM synthetic_receipts'));
    await assert.rejects(restoreSyntheticSnapshot(b,snapshot),/never overwrite/);
    const invalid=JSON.parse(JSON.stringify(snapshot));invalid.students[0].identity=JSON.stringify({...fixture[0],googleId:'foreign@example.invalid'});await assert.rejects(restoreSyntheticSnapshot(b,invalid),/scope mismatch/);
  }finally{await a.close();await b.close();fs.rmSync(dir,{recursive:true,force:true});}
});
