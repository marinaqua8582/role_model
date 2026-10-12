const {test}=require('node:test'),assert=require('node:assert/strict');
const {backend}=require('./mock-runtime.cjs');
const credentials={action:'verifyStudent',grade:3,classNum:1,number:1,name:'가상학생1'};

test('existing columns skip capacity service calls while new columns still expand safely',()=>{
  const b=backend(),s=b.sheets.get('Progress');let capacityReads=0,expansions=0;
  const capacity=s.getMaxColumns.bind(s),expand=s.insertColumnsAfter.bind(s);
  s.getMaxColumns=()=>{capacityReads++;return capacity();};s.insertColumnsAfter=(a,n)=>{expansions++;return expand(a,n);};
  b.context.requestReadContext_={studentKey:'3-1-1',tables:{},headerMaps:{},emptySheets:{}};
  b.context.writePatch_(s,2,{roleModelName:'synthetic'});assert.equal(capacityReads,0);assert.equal(expansions,0);
  s.maxColumns=s.getLastColumn();b.context.writePatch_(s,2,{syntheticExtraColumn:'value'});
  assert.ok(capacityReads>0);assert.equal(expansions,1);assert.equal(s.rows[1][s.rows[0].indexOf('syntheticExtraColumn')],'value');
});

test('student sheet handles are reused only within one request; absent sheets and other books remain fresh',()=>{
  const b=backend(),original=b.ss.getSheetByName.bind(b.ss);let calls=0;
  b.ss.getSheetByName=name=>{calls++;return original(name);};
  const token=b.request(credentials).studentToken;calls=0;
  assert.equal(b.request({action:'saveProgress',studentKey:'3-1-1',studentToken:token,roleModelName:'synthetic'}).success,true);
  assert.ok(calls<=6,`lookups=${calls}`);assert.equal(b.context.requestSheetCache_,undefined);
  b.context.requestSheetCache_={values:{}};
  b.context.requestSheet_(b.ss,'Progress');const before=calls;b.context.requestSheet_(b.ss,'Progress');assert.equal(calls,before);
  assert.equal(b.context.requestSheet_(b.ss,'Absent'),undefined);
  b.sheets.set('Absent',b.sheets.get('Tests'));assert.equal(b.context.requestSheet_(b.ss,'Absent'),b.sheets.get('Tests'));
  const other={getSheetByName:()=>({other:true})};assert.equal(b.context.requestSheet_(other,'Progress').other,true);
  b.context.requestSheetCache_=undefined;
});

test('header reuse preserves reordered columns and new schema between requests',()=>{
  const b=backend(),token=b.request(credentials).studentToken;
  const request=p=>b.request({studentKey:'3-1-1',studentToken:token,...p});
  assert.equal(request({action:'saveProgress',roleModelName:'before'}).success,true);
  const sheet=b.sheets.get('Progress');
  sheet.rows[0].push('teacherFormula');sheet.rows[1].push('=PRESERVE()');
  sheet.rows=sheet.rows.map(row=>row.slice().reverse());
  assert.equal(request({action:'saveProgress',roleModelName:'after'}).success,true);
  assert.equal(sheet.rows[1][sheet.rows[0].indexOf('teacherFormula')],'=PRESERVE()');
  assert.equal(request({action:'loadProgress'}).data.roleModelName,'after');
  assert.equal(b.context.requestReadContext_,undefined);
});

test('header reuse measurably removes duplicate reads without changing writes or lock scope',()=>{
  const b=backend(),token=b.request(credentials).studentToken;
  const request=p=>b.request({studentKey:'3-1-1',studentToken:token,...p});
  for(const action of ['saveProgress','saveTests','submitFinal'])assert.equal(request({action}).success,true);
  b.resetStats();const result=request({action:'saveTests',test1Result:'changed',measurePerformance:true});
  const stats=b.stats(),reads=Object.values(stats.sheets).reduce((sum,s)=>sum+s.reads,0);
  assert.equal(result.success,true);assert.equal(reads,11);
  assert.equal(result.performance.sheetReadCalls,reads);
  assert.equal(stats.locks,1);assert.equal(b.state.locked,false);
});

test('cached header arrays cannot be mutated by a caller and refresh after a write',()=>{
  const b=backend(),s=b.sheets.get('Progress');
  b.context.requestReadContext_={tables:{},headerMaps:{},emptySheets:{}};
  const first=b.context.physicalHeaders_(s);first.push('not-a-real-column');
  assert.equal(b.context.physicalHeaders_(s).includes('not-a-real-column'),false);
  b.context.writePatch_(s,-1,{studentKey:'3-1-1',newField:'value'});
  assert.equal(b.context.physicalHeaders_(s).at(-1),'newField');
  assert.equal(b.context.physicalHeaders_(s).includes('not-a-real-column'),false);
});
test('student metadata snapshot reuses service reads, invalidates on writes and never survives a request',()=>{
  const b=backend(),s=b.sheets.get('Progress');let reads=0;const raw=s.getLastRow.bind(s);s.getLastRow=()=>{reads++;return raw();};
  b.context.requestReadContext_={studentKey:'3-1-1',tables:{},headerMaps:{},emptySheets:{}};
  assert.equal(b.context.sheetMetadata_(s,'getLastRow'),raw());b.context.sheetMetadata_(s,'getLastRow');assert.equal(reads,1);
  b.context.writePatch_(s,2,{roleModelName:'synthetic changed'});const before=reads;
  b.context.sheetMetadata_(s,'getLastRow');assert.equal(reads,before+1);
  b.context.requestReadContext_=undefined;s.rows.push(s.rows[1].slice());
  assert.equal(b.context.sheetMetadata_(s,'getLastRow'),raw());assert.equal(reads,before+2);
});
test('student write budget changes neither real lock protection nor teacher lock policy',()=>{
  const b=backend(),budgets=[],original=b.context.LockService.getScriptLock;
  b.context.LockService.getScriptLock=()=>{const lock=original(),acquire=lock.tryLock;lock.tryLock=ms=>{budgets.push(ms);return acquire.call(lock,ms);};return lock;};
  const token=b.request({action:'verifyStudent',grade:3,classNum:1,number:1,name:'가상학생1'}).studentToken;
  const p={action:'saveProgress',studentKey:'3-1-1',studentToken:token,requestId:'budget_synthetic_0001',requestIssuedAt:Date.now()};
  assert.equal(b.request(p).success,true);assert.equal(budgets[0],60000);
  b.request({action:'updateRoster',adminSecret:'test-admin-secret',students:[]});assert.equal(budgets.at(-1),15000);
  b.state.denyLock=true;b.resetStats();assert.equal(b.request({...p,requestId:'budget_synthetic_0002'}).success,false);assert.equal(Object.values(b.stats().sheets).reduce((n,s)=>n+s.writes,0),0);
});

function staging() {
  const b=backend(),p=b.context.PropertiesService.getScriptProperties();
  b.ss.getSheets=()=>Array.from(b.sheets.values());for(const s of b.sheets.values())s.rows=[];
  p.setProperty('PERF_TEST_MODE','synthetic-25');p.setProperty('PERF_TEST_SPREADSHEET_ID',b.ss.getId());
  b.context.initializeEmptyPerformanceFixture();
  const runId='synthetic-hotpath-run-001';
  assert.equal(b.request({action:'getPerformanceFixture',adminSecret:'test-admin-secret',createPerformanceRun:{runId,exp:Date.now()+590000}}).success,true);
  const rows=[];b.context.Logger={log:s=>rows.push(JSON.parse(s))};
  const scope={performanceRunId:runId,performanceSubject:'3-99-1',measurePerformance:true};
  return {b,rows,scope};
}

test('staging GAS completion survives response loss with aggregate-only correlated logs',()=>{
  const {b,rows,scope}=staging(),id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const login=b.request({...scope,action:'verifyStudent',grade:3,classNum:99,number:1,name:'Synthetic Student 1',performanceTraceId:id});
  assert.equal(login.success,true);assert.equal(rows.length,1);assert.equal(rows[0].correlationId,id);
  assert.equal(rows[0].sheetReadCalls,login.performance.sheetReadCalls);
  assert.equal(/Synthetic|synthetic1@|studentToken|studentKey|googleId|http/.test(JSON.stringify(rows)),false);
  b.request({...scope,action:'loadProgress',studentKey:'3-99-1',studentToken:login.studentToken,performanceTraceId:'PRIVATE_INVALID_TRACE'});
  assert.equal(rows.length,1);
  b.request({...scope,performanceRunId:'invalid-run-00000001',action:'loadProgress',studentKey:'3-99-1',studentToken:login.studentToken,performanceTraceId:id});
  assert.equal(rows.length,1);
  b.context.Logger.log=()=>{throw Error('logging failure');};
  assert.equal(b.request({...scope,action:'loadProgress',studentKey:'3-99-1',studentToken:login.studentToken,performanceTraceId:id}).success,true);
});

test('a new transport trace does not defeat save request idempotency',()=>{
  const {b,scope}=staging();
  const token=b.request({...scope,action:'verifyStudent',grade:3,classNum:99,number:1,name:'Synthetic Student 1'}).studentToken;
  const payload={...scope,action:'saveProgress',studentKey:'3-99-1',studentToken:token,requestId:'same_request_hotpath_0001',requestIssuedAt:Date.now(),roleModelName:'synthetic'};
  assert.equal(b.request({...payload,performanceTraceId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'}).success,true);
  b.resetStats();const repeated=b.request({...payload,performanceTraceId:'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee'});
  assert.equal(repeated.success,true);assert.equal(repeated.replayed,true);
  assert.equal(Object.values(b.stats().sheets).reduce((sum,s)=>sum+s.writes,0),0);
  assert.equal(b.sheets.get('Progress').rows.length,2);
});
test('bounded staging trace fallback is aggregate-only and restricted to its live run administrator',()=>{
  const {b,scope}=staging(),id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  b.request({...scope,action:'verifyStudent',grade:3,classNum:99,number:1,name:'Synthetic Student 1',performanceTraceId:id});
  const root={...scope,performanceSubject:'run',adminSecret:'test-admin-secret',action:'getPerformanceTrace',traceId:id};
  const result=b.request(root);assert.equal(result.success,true);assert.equal(result.found,true);assert.equal(result.trace.correlationId,id);
  assert.equal(/studentKey|googleId|Synthetic|studentToken|runId|http/.test(JSON.stringify(result)),false);
  assert.equal(b.request({...root,adminSecret:'wrong'}).success,false);
  assert.equal(b.request({...root,performanceSubject:'3-99-1'}).success,false);
  assert.equal(b.request({...root,performanceRunId:'different-run-000000'}).success,false);
  assert.equal(b.request({...root,traceId:'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee'}).found,false);
});

test('login probe rejects invalid wave sizes and does not retry failures or perform student writes',async()=>{
  const {probe,probeCount}=require('./staging-login-probe.cjs');
  for(const count of [undefined,0,2,26,'1.0'])assert.throws(()=>probeCount(count));
  const env={STAGING_CONFIRM:'SYNTHETIC_25_ONLY',STAGING_URL:'https://staging-fixture.vercel.app/',STAGING_TEST_SECRET:'PRIVATE_SECRET',TEST_SPREADSHEET_ID:'PRIVATE_SHEET'};
  const actions=[];
  const result=await probe(5,env,async(_url,options)=>{
    const body=JSON.parse(options.body);actions.push(body.action);
    const data=body.action==='startPerformanceRun'?{success:true,runToken:'PRIVATE_RUN',studentTokens:Array(25).fill('PRIVATE_TOKEN'),fixture:{spreadsheetId:env.TEST_SPREADSHEET_ID}}:
      body.action==='finishPerformanceRun'?{success:true,ended:true}:{success:false,message:'PRIVATE_UPSTREAM_ERROR'};
    return {status:200,ok:true,headers:{get:()=>null},json:async()=>data};
  });
  assert.equal(result.completed,false);assert.equal(result.ended,true);
  assert.deepEqual(actions,['startPerformanceRun',...Array(5).fill('verifyStudent'),'finishPerformanceRun']);
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});
