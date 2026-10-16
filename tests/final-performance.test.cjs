const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
const {backend}=require('./mock-runtime.cjs');
const login=b=>b.request({action:'verifyStudent',grade:3,classNum:1,number:1,name:'가상학생1'});
function triggers(b) {
  let list=[],sequence=0,created=0;
  b.context.ScriptApp={getProjectTriggers:()=>list.slice(),deleteTrigger:t=>{list=list.filter(x=>x!==t);},newTrigger:handler=>({timeBased(){return this;},everyMinutes(n){assert.equal(n,5);return this;},create(){created++;const uid='trigger_'+(++sequence);const t={getHandlerFunction:()=>handler,getUniqueId:()=>uid};list.push(t);return t;}})};
  return {list:()=>list,created:()=>created};
}
function apiModule(fetchImpl) {
  const exports={},env={STAGING_PERF_MODE:'synthetic-25',STAGING_ORIGIN:'https://staging-fixture.vercel.app',TEST_GAS_URL:'https://script.google.com/macros/s/synthetic/exec',TEST_SPREADSHEET_ID:'synthetic-sheet',STAGING_GAS_ADMIN_SECRET:'synthetic-admin',STAGING_TEST_SECRET:'synthetic-start',STAGING_TOKEN_SECRET:'synthetic-signing-secret-32-characters-minimum'};
  const source=fs.readFileSync(path.join(__dirname,'../api/staging-performance.ts'),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,process:{env},Buffer,URL,AbortSignal,fetch:fetchImpl});return {exports,env};
}
test('authentication policy functions remain byte-equivalent to the supplied ZIP',()=>{
  const manifest=require('./fixtures/auth-policy-baseline.json'),code=fs.readFileSync(path.join(__dirname,'../GoogleAppsScript.latest.gs'),'utf8').replace(/\r\n/g,'\n');
  for(const [name,hash] of Object.entries(manifest)){const start=code.indexOf('function '+name+'('),next=code.indexOf('\nfunction ',start+1);assert.equal(crypto.createHash('sha256').update(code.slice(start,next<0?code.length:next).trim()).digest('hex'),hash,name);}
});
test('signed staging tokens reject forgery, expiry, wrong origin, wrong sheet and cross-student reuse',()=>{
  const {exports:e,env}=apiModule(async()=>{throw Error('No fetch expected');});const now=Date.now(),claims={runId:'synthetic-run-00000001',exp:now+500000,sheet:env.TEST_SPREADSHEET_ID,origin:env.STAGING_ORIGIN,subject:'3-99-1'},token=e.signTestToken(claims,env.STAGING_TOKEN_SECRET),scope={sheet:claims.sheet,origin:claims.origin};
  assert.equal(e.verifyTestToken(token,env.STAGING_TOKEN_SECRET,scope).subject,'3-99-1');
  assert.throws(()=>e.verifyTestToken('x'+token.slice(1),env.STAGING_TOKEN_SECRET,scope));
  assert.throws(()=>e.verifyTestToken(token,env.STAGING_TOKEN_SECRET,scope,now+500001));
  assert.throws(()=>e.verifyTestToken(token,env.STAGING_TOKEN_SECRET,{...scope,origin:'https://role-model-one.vercel.app'}));
  assert.throws(()=>e.verifyTestToken(token,env.STAGING_TOKEN_SECRET,{...scope,sheet:'production-sheet'}));
  assert.throws(()=>e.verifySyntheticRequest({action:'saveProgress',studentKey:'3-99-2'},'3-99-1'));
  assert.throws(()=>e.verifySyntheticRequest({action:'verifyStudent',grade:3,classNum:99,number:1,name:'real person'},'3-99-1'));
  assert.throws(()=>e.verifySyntheticRequest({action:'saveProgress',studentKey:'3-99-1',progress:{studentKey:'3-1-1'}},'3-99-1'));
});
test('API inspects full fixture only once, binds student token and uses one upstream call per operation',async()=>{
  const actions=[];let active;
  const fetch=async(_url,o)=>{const p=JSON.parse(o.body);actions.push(p.action);let data;
    if(p.action==='getPerformanceFixture'){active=p.createPerformanceRun;data={success:true,protocol:'staging-session-v2',runId:active.runId,marker:'synthetic-25',spreadsheetId:'synthetic-sheet',duplicates:0,foreignRows:0};}
    else {data={success:active?.runId===p.performanceRunId};if(p.action==='finishPerformanceRun'){active=null;data.ended=true;}}
    return {ok:true,json:async()=>data};};
  const {exports:e,env}=apiModule(fetch);
  const invoke=async(module,body,token)=>{const res={status(n){this.code=n;return this;},setHeader(){},json(data){this.data=data;return this;}};await module.default({method:'POST',headers:{host:'staging-fixture.vercel.app',authorization:'Bearer '+token},body},res);return res;};
  const start=await invoke(e,{action:'startPerformanceRun'},env.STAGING_TEST_SECRET);assert.equal(start.data.success,true);assert.equal(JSON.stringify(start.data).includes(env.STAGING_GAS_ADMIN_SECRET),false);
  await invoke(e,{action:'verifyStudent',grade:3,classNum:99,number:1,name:'Synthetic Student 1'},start.data.studentTokens[0]);
  await invoke(e,{action:'saveProgress',studentKey:'3-99-1'},start.data.studentTokens[0]);
  assert.equal((await invoke(e,{action:'saveProgress',studentKey:'3-99-2'},start.data.studentTokens[0])).code,403);
  assert.deepEqual(actions,['getPerformanceFixture','verifyStudent','saveProgress']);
  await invoke(e,{action:'finishPerformanceRun'},start.data.runToken);
  // Separate serverless instance, same durable upstream state: ended token cannot revive run.
  const second=apiModule(fetch).exports;assert.equal((await invoke(second,{action:'getPerformanceSnapshot'},start.data.runToken)).data.success,false);
});
test('cleanup trigger installs once, status reports it and removal preserves unrelated triggers',()=>{
  const b=backend(),state=triggers(b);assert.equal(state.created(),0);
  assert.equal(b.context.installSaveReceiptCleanupTrigger().created,true);assert.equal(b.context.installSaveReceiptCleanupTrigger().created,false);assert.equal(state.created(),1);assert.equal(b.context.getSaveReceiptCleanupStatus().visibleTriggers,1);
  b.context.ScriptApp.newTrigger('unrelated').timeBased().everyMinutes(5).create();
  assert.equal(b.context.removeSaveReceiptCleanupTrigger().removed,1);assert.equal(state.list()[0].getHandlerFunction(),'unrelated');assert.equal(b.context.getSaveReceiptCleanupStatus().installed,false);
});
test('registered trigger invisible to a different administrator is not duplicated',()=>{
  const b=backend(),state=triggers(b);b.context.installSaveReceiptCleanupTrigger();b.context.ScriptApp.getProjectTriggers=()=>[];
  assert.throws(()=>b.context.installSaveReceiptCleanupTrigger(),/관리자/);assert.equal(state.created(),1);assert.equal(b.context.getSaveReceiptCleanupStatus().installed,null);
});
test('manual cleanup triggers are replaced with one managed five-minute trigger',()=>{
  const b=backend(),state=triggers(b);b.context.ScriptApp.newTrigger('purgeExpiredSaveReceipts').timeBased().everyMinutes(5).create();
  b.context.ScriptApp.newTrigger('purgeExpiredSaveReceipts').timeBased().everyMinutes(5).create();
  assert.equal(b.context.installSaveReceiptCleanupTrigger().created,true);assert.equal(state.list().length,1);assert.equal(b.context.installSaveReceiptCleanupTrigger().created,false);
});
test('one cleanup invocation limits expired deletes so maintenance does not monopolize the lock',()=>{
  const b=backend(),p=b.context.PropertiesService.getScriptProperties();for(let i=0;i<60;i++)p.setProperty('save-receipt:expired_'+i,JSON.stringify({state:'completed',expiresAt:Date.now()-1}));
  const result=b.context.purgeExpiredSaveReceipts();assert.equal(result.deleted,50);assert.equal(result.remaining,10);assert.equal(result.deferredExpired,10);
});
test('cleanup preserves valid, pending, unknown and malformed receipts; records aggregate counts',()=>{
  const b=backend();triggers(b);const p=b.context.PropertiesService.getScriptProperties(),old=Date.now()-1;
  for(const [id,state,expiresAt] of [['expired','completed',old],['live','completed',old+600000],['pending','pending',old],['unknown','unknown',old]])p.setProperty('save-receipt:'+id,JSON.stringify({state,expiresAt}));
  p.setProperty('save-receipt:malformed','not json');
  const result=b.context.purgeExpiredSaveReceipts();assert.equal(result.deleted,1);assert.equal(result.remaining,4);assert.equal(result.protectedPending,2);assert.equal(result.malformed,1);
  for(const id of ['live','pending','unknown','malformed'])assert.ok(p.getProperty('save-receipt:'+id));assert.equal(b.context.getSaveReceiptCleanupStatus().last.deleted,1);
});
test('cleanup cannot mutate properties while a save owns the global lock',()=>{
  const b=backend(),p=b.context.PropertiesService.getScriptProperties();p.setProperty('save-receipt:expired',JSON.stringify({state:'completed',expiresAt:Date.now()-1}));b.state.denyLock=true;
  assert.equal(b.context.purgeExpiredSaveReceipts().lockTimeout,true);assert.ok(p.getProperty('save-receipt:expired'));
});
test('lock timeout emits failure metrics and creates no duplicate/new rows',()=>{
  const b=backend(),token=login(b).studentToken;b.resetStats();b.state.denyLock=true;
  const result=b.request({action:'saveProgress',studentKey:'3-1-1',studentToken:token,measurePerformance:true});
  assert.equal(result.success,false);assert.equal(result.performance.lockTimeoutCount,1);assert.equal(result.performance.lockHeldMs,0);assert.equal(b.sheets.get('Progress').rows.length,1);assert.equal(Object.values(b.stats().sheets).reduce((n,s)=>n+s.writes,0),0);
});
test('sheet mutation and flush spans are separately measured within the real lock scope',()=>{
  const b=backend(),token=login(b).studentToken;let clock=Date.now();b.context.Date=class extends Date{static now(){return clock++;}};
  for(const sheet of b.sheets.values()){const range=sheet.getRange.bind(sheet);sheet.getRange=(...args)=>{const r=range(...args),write=r.setValues;r.setValues=v=>{assert.equal(b.state.locked,true);clock+=20;return write(v);};return r;};}
  b.context.SpreadsheetApp.flush=()=>{assert.equal(b.state.locked,true);clock+=7;};
  const result=b.request({action:'saveProgress',studentKey:'3-1-1',studentToken:token,measurePerformance:true});assert.equal(result.success,true);
  assert.ok(result.performance.sheetWriteMs>=20);assert.ok(result.performance.flushMs>=7);assert.ok(result.performance.lockHeldMs>=result.performance.sheetWriteMs+result.performance.flushMs);assert.ok(result.performance.totalMs>=result.performance.lockHeldMs);assert.equal(b.state.locked,false);
});
test('Properties capacity failure rejects before sheet writes and explains administrator recovery',()=>{
  const b=backend(),token=login(b).studentToken,p=b.context.PropertiesService.getScriptProperties();b.context.PropertiesService.getScriptProperties=()=>({...p,setProperty(){throw Error('quota');}});b.resetStats();
  const result=b.request({action:'saveProgress',studentKey:'3-1-1',studentToken:token});assert.equal(result.success,false);assert.match(result.message,/관리자.*Script Properties/);assert.equal(Object.values(b.stats().sheets).reduce((n,s)=>n+s.writes,0),0);
});
test('GAS persists active test run and revokes it without reading the whole fixture again',()=>{
  const b=backend(),p=b.context.PropertiesService.getScriptProperties();b.ss.getSheets=()=>Array.from(b.sheets.values());for(const s of b.sheets.values())s.rows=[];
  p.setProperty('PERF_TEST_MODE','synthetic-25');p.setProperty('PERF_TEST_SPREADSHEET_ID',b.ss.getId());b.context.initializeEmptyPerformanceFixture();
  const runId='synthetic-active-run-001';assert.equal(b.request({action:'getPerformanceFixture',adminSecret:'test-admin-secret',createPerformanceRun:{runId,exp:Date.now()+590000}}).protocol,'staging-session-v2');
  const student=b.request({action:'verifyStudent',grade:3,classNum:99,number:1,name:'Synthetic Student 1',performanceRunId:runId,performanceSubject:'3-99-1'});assert.equal(student.success,true);assert.equal(student.student.googleId,'synthetic1@example.invalid');assert.equal(JSON.stringify(student).includes('synthetic2@example.invalid'),false);
  assert.equal(b.request({action:'finishPerformanceRun',adminSecret:'test-admin-secret',performanceRunId:runId,performanceSubject:'run'}).ended,true);
  b.resetStats();assert.equal(b.request({action:'saveProgress',studentKey:'3-99-1',studentToken:student.studentToken,performanceRunId:runId,performanceSubject:'3-99-1'}).success,false);assert.equal(Object.values(b.stats().sheets).reduce((n,s)=>n+s.writes,0),0);
});
test('administrator status logging excludes unrecognized or private property content',()=>{
  const b=backend();triggers(b);const logs=[];b.context.Logger={log:x=>logs.push(x)};
  b.context.PropertiesService.getScriptProperties().setProperty('SAVE_RECEIPT_CLEANUP_LAST',JSON.stringify({deleted:2,remaining:1,at:'private@example.invalid',studentName:'private student',studentToken:'private-token'}));
  const status=b.context.getSaveReceiptCleanupStatus();assert.equal(status.last.deleted,2);assert.equal(JSON.stringify(logs).includes('private'),false);
});
test('three 25-user runner cases exercise loss, cancellation and all table integrity using synthetic emulation only',async()=>{
  const {runCase}=require('./staging-load.cjs'),originalFetch=global.fetch,previousConfirm=process.env.STAGING_CONFIRM,previousSecret=process.env.STAGING_TEST_SECRET;
  process.env.STAGING_CONFIRM='SYNTHETIC_25_ONLY';process.env.STAGING_TEST_SECRET='synthetic-start';
  try {
    for(let round=1;round<=3;round++) {
      const b=backend();b.ss.getId=()=>`synthetic-sheet-${round}`;b.ss.getSheets=()=>Array.from(b.sheets.values());for(const s of b.sheets.values())s.rows=[];
      const p=b.context.PropertiesService.getScriptProperties();p.setProperty('PERF_TEST_MODE','synthetic-25');p.setProperty('PERF_TEST_SPREADSHEET_ID',b.ss.getId());b.context.initializeEmptyPerformanceFixture();
      let fixtures=0;const errors=[];
      const {exports:e,env}=apiModule(async(_u,o)=>{const body=JSON.parse(o.body);if(body.action==='getPerformanceFixture')fixtures++;const data=b.request(body);if(!data.success)errors.push({action:body.action,message:data.message});return {ok:true,json:async()=>data};});
      env.STAGING_ORIGIN=`https://staging-local-case-${round}.vercel.app`;env.TEST_SPREADSHEET_ID=b.ss.getId();env.STAGING_GAS_ADMIN_SECRET='test-admin-secret';
      global.fetch=async(url,o)=>{const res={code:200,status(n){this.code=n;return this;},setHeader(){},json(data){this.data=data;return this;}};
        await e.default({method:'POST',headers:{host:new URL(url).host,authorization:o.headers.Authorization},body:JSON.parse(o.body)},res);
        return {ok:res.code>=200&&res.code<300,status:res.code,json:async()=>res.data};};
      const result=await runCase({url:env.STAGING_ORIGIN+'/',spreadsheetId:b.ss.getId()});
      assert.equal(result.completed,true,result.error+' '+JSON.stringify(errors));assert.equal(result.ended,true);assert.equal(result.revocationVerified,true);assert.equal(fixtures,1);
      assert.equal(result.responseLoss.automaticResaves,0);assert.equal(result.cancelledLateWrite.rejected,true);assert.equal(result.wrongStudentUpdates,0);
      for(const suite of Object.values(result.suites))assert.equal(suite.successRate,1);
      for(const table of Object.values(result.after.sheets)){assert.equal(table.rows,25);assert.equal(table.duplicates,0);}
    }
  } finally {global.fetch=originalFetch;if(previousConfirm===undefined)delete process.env.STAGING_CONFIRM;else process.env.STAGING_CONFIRM=previousConfirm;if(previousSecret===undefined)delete process.env.STAGING_TEST_SECRET;else process.env.STAGING_TEST_SECRET=previousSecret;}
});
