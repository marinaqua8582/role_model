const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {client}=require('./mock-client.cjs'),{backend}=require('./mock-runtime.cjs'),{targetFromEnvironment}=require('./performance-target.cjs');
const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
test('load test rejects missing target, production, Google, DNS, credentials and non-loopback URLs',()=>{
  const previous=process.env.PERF_TARGET_URL;
  try{
    for(const value of [undefined,'https://role-model-one.vercel.app/','https://script.google.com/','http://localhost:3000/','http://example.com/','http://127.0.0.1.evil.invalid/','http://u:p@127.0.0.1/','http://127.0.0.1/api']){
      if(value)process.env.PERF_TARGET_URL=value;else delete process.env.PERF_TARGET_URL;
      assert.throws(targetFromEnvironment);
    }
    process.env.PERF_TARGET_URL='http://127.0.0.1:0/';assert.equal(targetFromEnvironment().hostname,'127.0.0.1');
  }finally{if(previous===undefined)delete process.env.PERF_TARGET_URL;else process.env.PERF_TARGET_URL=previous;}
});
for(const status of [400,401,403,404,422,504])test('HTTP '+status+' never automatically retries',async()=>{
  const state={apiCalls:0},api=client('http://127.0.0.1/',state,async()=>response(status,{}));
  await assert.rejects(()=>api.callGasApi({action:'getRosterOptions'}));assert.equal(state.apiCalls,1);
});
for(const status of [429,500,502,503])test('HTTP '+status+' concurrent duplicate requests share one bounded retry',async()=>{
  const state={apiCalls:0};let attempts=0;
  const api=client('http://127.0.0.1/',state,async()=>response(++attempts===1?status:200,{success:true}));
  const result=await Promise.all(Array.from({length:25},()=>api.callGasApi({action:'getRosterOptions'})));
  assert.ok(result.every(r=>r.success));assert.equal(state.apiCalls,2);
});
test('network interruption retries once; repeated failure stops at two calls',async()=>{
  const state={apiCalls:0},api=client('http://127.0.0.1/',state,async()=>{throw new TypeError('synthetic network failure');});
  await assert.rejects(()=>api.callGasApi({action:'getRosterOptions'}));assert.equal(state.apiCalls,2);
});
test('timeout stops without retry and blocks further saves',async()=>{
  const state={apiCalls:0},api=client('http://127.0.0.1/',state,async()=>{throw new DOMException('synthetic timeout','TimeoutError');});
  await assert.rejects(()=>api.callGasApi({action:'saveProgress',studentKey:'3-1-1'}));assert.equal(state.apiCalls,1);assert.equal(api.hasUncertainSave("3-1-1"),true);
  await assert.rejects(()=>api.callGasApi({action:"saveProgress",studentKey:"3-1-1"})); assert.equal(state.apiCalls,1);
});
test('application validation failure never retries or marks server save success',async()=>{
  const state={apiCalls:0},api=client('http://127.0.0.1/',state,async()=>response(200,{success:false,message:'validation'}));
  assert.equal((await api.callGasApi({action:'saveProgress',studentKey:'3-1-1'})).success,false);
  assert.equal(state.apiCalls,1);assert.equal(api.getLastServerSaveTime(),'');
});
test('option cache whitelists safe numbers and shares in-flight requests',async()=>{
  const state={apiCalls:0},api=client('http://127.0.0.1/',state,async()=>response(200,{success:true,data:{grades:[3],classesByGrade:{3:[1]},numbersByClass:{'3-1':[1]},name:'private',googleId:'private@example.invalid'}}));
  const options=await Promise.all(Array.from({length:25},()=>api.getRosterOptions()));
  assert.equal(state.apiCalls,1);assert.equal(JSON.stringify(options).includes('private'),false);
  await api.getRosterOptions();assert.equal(state.apiCalls,1);
  api.invalidateRosterOptions();await api.getRosterOptions();assert.equal(state.apiCalls,2);
});
test('concurrent login is one request and returns only own full Google ID and progress',async()=>{
  const b=backend(),state={apiCalls:0},api=client('http://127.0.0.1/',state,async(_url,options)=>response(200,b.request(JSON.parse(options.body))));
  const results=await Promise.all(Array.from({length:25},()=>api.verifyStudentAuth({grade:3,classNum:1,number:1,name:'가상학생1'})));
  assert.ok(results.every(r=>r.success&&r.student.googleId==='mock1@example.invalid'));
  assert.equal(state.apiCalls,1);assert.equal(JSON.stringify(results).includes('mock2@example.invalid'),false);
});
test('options cache invalidates after roster edit; reads proceed when write lock is unavailable',()=>{
  const b=backend();
  assert.equal(b.request({action:'getRosterOptions'}).data.numbersByClass['3-1'].length,25);
  assert.equal(b.request({action:'deleteRosterStudents',adminSecret:'test-admin-secret',students:[{grade:3,classNum:1,number:25}]}).success,true);
  assert.equal(b.request({action:'getRosterOptions'}).data.numbersByClass['3-1'].length,24);
  b.state.denyLock=true;
  const login=b.request({action:'verifyStudent',grade:3,classNum:1,number:1,name:'가상학생1'});assert.equal(login.success,true);
  assert.equal(b.request({action:'saveProgress',studentToken:login.studentToken,studentKey:'3-1-1'}).success,false);
  assert.equal(b.state.locked,false);
});
test('row insertion/deletion is safely rediscovered without a row-number cache',()=>{
  const b=backend(),login=n=>b.request({action:'verifyStudent',grade:3,classNum:1,number:n,name:'가상학생'+n});
  const t1=login(1).studentToken,t2=login(2).studentToken;
  assert.equal(b.request({action:'saveProgress',studentToken:t1,studentKey:'3-1-1',roleModelName:'one'}).success,true);
  assert.equal(b.request({action:'saveProgress',studentToken:t2,studentKey:'3-1-2',roleModelName:'two'}).success,true);
  const sheet=b.sheets.get('Progress');sheet.deleteRow(2);
  assert.equal(b.request({action:'saveProgress',studentToken:t1,studentKey:'3-1-1',roleModelName:'new one'}).success,true);
  assert.equal(sheet.rows[1][0],'3-1-2');assert.equal(sheet.rows[1][6],'two');assert.equal(sheet.rows[2][6],'new one');
});
test('student proxy rejects privileged actions, forwards no errors/URLs, and sets no-store',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../api/gas-proxy.ts'),'utf8');
  const exports={};let calls=0;
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process:{env:{GAS_URL:'https://example.invalid/private'}},AbortSignal,fetch:async()=>{calls++;throw Error('secret-url');}});
  const res=()=>({headers:{},status(code){this.code=code;return this;},setHeader(k,v){this.headers[k]=v;},json(data){this.data=data;return this;}});
  let r=res();await exports.default({method:'POST',body:{action:'getAdminDashboard'}},r);assert.equal(r.code,403);assert.equal(calls,0);
  r=res();await exports.default({method:'POST',body:{action:'verifyStudent'}},r);assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(JSON.stringify(r.data).includes('secret-url'),false);
});
