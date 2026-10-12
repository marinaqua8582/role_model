const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs');
const {backend}=require('./mock-runtime.cjs');
const {client}=require('./mock-client.cjs');
const login=b=>b.request({action:'verifyStudent',grade:3,classNum:1,number:1,name:'가상학생1'});
test('fixture setup requires explicit dedicated ID, empty sheets and preserves existing data',()=>{
  const b=backend();b.ss.getSheets=()=>Array.from(b.sheets.values());
  assert.throws(()=>b.context.initializeEmptyPerformanceFixture());
  const props=b.context.PropertiesService.getScriptProperties();props.setProperty('PERF_TEST_MODE','synthetic-25');props.setProperty('PERF_TEST_SPREADSHEET_ID',b.ss.getId());
  const before=JSON.stringify(b.sheets.get('Roster').rows);assert.throws(()=>b.context.initializeEmptyPerformanceFixture());assert.equal(JSON.stringify(b.sheets.get('Roster').rows),before);
  for(const sheet of b.sheets.values())sheet.rows=[]; // Clear ONLY this in-memory synthetic fixture.
  b.context.initializeEmptyPerformanceFixture();
  const fixture=b.request({action:'getPerformanceFixture',adminSecret:'test-admin-secret'});
  assert.equal(fixture.marker,'synthetic-25');assert.equal(fixture.rowCounts.Progress,0);assert.equal(fixture.duplicates,0);assert.equal(fixture.foreignRows,0);
  assert.equal(b.sheets.get('Roster').rows.length,26);assert.equal(b.state.locked,false);
});
test('receipt maintenance removes only expired receipts under a real script lock',()=>{
  const b=backend(),props=b.context.PropertiesService.getScriptProperties();
  props.setProperty('save-receipt:expired_synthetic',JSON.stringify({state:'completed',expiresAt:Date.now()-1}));
  props.setProperty('save-receipt:live_synthetic',JSON.stringify({state:'completed',expiresAt:Date.now()+600000}));
  props.setProperty('unrelated-config','preserved');
  b.resetStats();b.context.purgeExpiredSaveReceipts();
  assert.equal(props.getProperty('save-receipt:expired_synthetic'),undefined);assert.ok(props.getProperty('save-receipt:live_synthetic'));assert.equal(props.getProperty('unrelated-config'),'preserved');assert.equal(b.state.acquired,1);assert.equal(b.state.locked,false);
});
test('missing request IDs are rejected before any student write',()=>{
  const b=backend(),token=login(b).studentToken;b.resetStats();
  const raw=b.context.handleRequest({postData:{contents:JSON.stringify({action:'saveProgress',studentKey:'3-1-1',studentToken:token})}});
  assert.equal(JSON.parse(raw.text).success,false);assert.equal(b.state.acquired,0);assert.equal(Object.values(b.stats().sheets).reduce((n,s)=>n+s.writes,0),0);
});
test('staging runner refuses production, missing confirmation and an arbitrary staging URL',()=>{
  const {guard}=require('./staging-load.cjs');
  assert.throws(()=>guard({}));
  const env={STAGING_CONFIRM:'SYNTHETIC_25_ONLY',STAGING_TEST_SECRET:'synthetic-secret',TEST_SPREADSHEET_ID:'synthetic-sheet'};
  for(const STAGING_URL of ['https://role-model-one.vercel.app/','https://script.google.com/','https://example.invalid/','http://staging-fixture.vercel.app/']) assert.throws(()=>guard({...env,STAGING_URL}));
  assert.equal(guard({...env,STAGING_URL:'https://staging-fixture.vercel.app/'}).hostname,'staging-fixture.vercel.app');
});
test('optional batch failure does not fall back to extra reads or report success',()=>{
  const b=backend(); b.enableBatch(); b.context.Sheets.Spreadsheets.Values.batchGet=()=>{throw Error('synthetic 429');};
  b.resetStats();assert.equal(login(b).success,false);assert.equal(Object.values(b.stats().sheets).reduce((n,s)=>n+s.reads,0),0);
});
test('batch header/identity reads preserve own details and reduce logical calls for 25/120 students',()=>{
  const measured=[];
  for(const size of [25,120]) {
    const b=backend();
    for(let n=26;n<=size;n++) b.sheets.get('Roster').appendRow([3,1,n,'가상학생'+n,'mock'+n+'@example.invalid']);
    for(let n=1;n<=size;n++) {
      const token=b.request({action:'verifyStudent',grade:3,classNum:1,number:n,name:'가상학생'+n}).studentToken;
      for(const action of ['saveProgress','saveTests','submitFinal']) assert.equal(b.request({action,studentKey:'3-1-'+n,studentToken:token,roleModelName:'synthetic',test1Result:'good',finalPrompt:'own prompt '+n}).success,true);
    }
    b.resetStats(); const narrow=login(b), before=b.stats();
    b.enableBatch();b.resetStats(); const batched=login(b), after=b.stats();
    const sum=(s,f)=>Object.values(s.sheets).reduce((n,v)=>n+v[f],0);
    assert.equal(narrow.success,true);assert.equal(batched.success,true);
    // Tokens vary; complete student/progress response must be equivalent.
    delete narrow.studentToken;delete batched.studentToken;assert.deepEqual(batched,narrow);
    assert.equal(sum(before,'reads'),11);assert.equal(sum(after,'reads'),4);assert.equal(b.batchStats.calls,2);
    assert.equal(sum(before,'cells')-(2*size-5),sum(after,'cells')+b.batchStats.cells);
    assert.equal(JSON.stringify(batched).includes('mock2@example.invalid'),false);
    measured.push({size,beforeGetValues:sum(before,'reads'),afterGetValues:sum(after,'reads'),batchGet:b.batchStats.calls,beforeCells:sum(before,'cells'),afterCells:sum(after,'cells')+b.batchStats.cells});
    // Existing and new writes must both retain an actual ScriptLock.
    const token=login(b).studentToken;
    assert.equal(b.request({action:'saveProgress',studentKey:'3-1-1',studentToken:token,step2:{targetUser:'changed'}}).success,true);
    assert.equal(login(b).progress.stepData.step2.targetUser,'changed');
  }
  fs.writeFileSync(require('node:path').join(__dirname,'../../second-measurements.json'),JSON.stringify(measured,null,2));
});
test('receipts prevent replay, mismatched payloads, cross-student access and late writes after cancellation',()=>{
  const b=backend(),token=login(b).studentToken, requestIssuedAt=Date.now();
  const request={action:'saveProgress',studentKey:'3-1-1',studentToken:token,requestId:'synthetic_request_00001',requestIssuedAt,roleModelName:'first'};
  assert.equal(b.request(request).success,true);
  b.resetStats();assert.equal(b.request(request).replayed,true);assert.equal(Object.values(b.stats().sheets).reduce((n,s)=>n+s.writes,0),0);
  assert.equal(b.request({...request,roleModelName:'different'}).success,false);
  const t2=b.request({action:'verifyStudent',grade:3,classNum:1,number:2,name:'가상학생2'}).studentToken;
  assert.equal(b.request({action:'getSaveStatus',studentKey:'3-1-2',studentToken:t2,requestId:request.requestId,requestIssuedAt}).success,false);
  const id='synthetic_cancelled_0001';
  assert.equal(b.request({action:'getSaveStatus',studentKey:'3-1-1',studentToken:token,requestId:id,requestIssuedAt}).state,'cancelled');
  assert.equal(b.request({...request,requestId:id}).success,false);
  assert.equal(b.request({...request,requestId:'synthetic_expired_0001',requestIssuedAt:Date.now()-700000}).success,false);
});
test('flush failure never reports success or allows uncertain request replay',()=>{
  const b=backend(),token=login(b).studentToken;
  b.context.SpreadsheetApp.flush=()=>{throw Error('synthetic flush failure');};
  const req={action:'saveProgress',studentKey:'3-1-1',studentToken:token,requestId:'synthetic_flush_000001',requestIssuedAt:Date.now(),roleModelName:'partial'};
  assert.equal(b.request(req).success,false);assert.equal(b.state.locked,false);
  assert.equal(b.request(req).success,false);
});
test('client write network failure is one call; cancellation confirmation unlocks safe new request',async()=>{
  const b=backend(),state={apiCalls:0};let fail=false;
  const api=client('http://127.0.0.1/',state,async(_u,o)=>{if(fail)throw new TypeError('synthetic failure');return {ok:true,json:async()=>b.request(JSON.parse(o.body))};});
  await api.verifyStudentAuth({grade:3,classNum:1,number:1,name:'가상학생1'});
  fail=true;const before=state.apiCalls;
  await assert.rejects(()=>api.callGasApi({action:'saveProgress',studentKey:'3-1-1'}),/확인할 수 없습니다/);
  await assert.rejects(()=>api.callGasApi({action:'saveProgress',studentKey:'3-1-1'}));assert.equal(state.apiCalls,before+1);
  fail=false;assert.equal((await api.confirmPendingSave()).state,'cancelled');assert.equal(api.isStudentSaving(),false);
  assert.equal((await api.callGasApi({action:'saveProgress',studentKey:'3-1-1'})).success,true);
});
