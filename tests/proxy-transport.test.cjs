const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
async function proxy(action,fetchImpl){const exports={},logs=[],budgets=[],headers={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../api/gas-proxy.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process:{env:{GAS_URL:'https://script.google.com/macros/s/PRIVATE_URL/exec',STAGING_PERF_MODE:'synthetic-25'}},crypto:{randomUUID:()=> 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'},URL,console:{info:s=>logs.push(JSON.parse(s))},AbortSignal:{timeout:ms=>{budgets.push(ms);return {}; }},fetch:fetchImpl});
 const res={setHeader(k,v){headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
 await exports.default({method:'POST',body:{action,performanceRunId:'synthetic-run-00001',studentToken:'PRIVATE_TOKEN'}},res);return {res,logs,budgets,headers};
}
test('real student proxy separates read/write budgets and traces redirects without repeating saves or leaking payload',async()=>{
 for(const [action,budget] of [['saveProgress',75000],['verifyStudent',15000]]){const calls=[];
  const result=await proxy(action,async(_url,o)=>{calls.push(o);return calls.length===1?{status:302,headers:{get:()=> 'https://script.googleusercontent.com/macros/echo?private=PRIVATE_KEY'}}:{status:200,ok:true,url:'https://script.googleusercontent.com/macros/echo',json:async()=>({success:true})};});
  assert.deepEqual(calls.map(x=>x.method),['POST','GET']);assert.equal(calls[1].body,undefined);assert.deepEqual(result.budgets,[budget]);assert.equal(result.res.data.success,true);assert.ok(result.headers['X-Staging-Correlation-Id']);assert.equal(JSON.stringify(result.logs).includes('PRIVATE'),false);
 }
});
test('real student proxy never resubmits a failed POST and blocks foreign redirect targets',async()=>{
 for(const failure of ['transport','redirect','json']){let calls=0;const result=await proxy('saveProgress',async()=>{calls++;if(failure==='transport')throw Error('PRIVATE_TOKEN');if(failure==='json')return {status:200,ok:true,headers:{get:k=>k==='content-type'?'text/html':'100'},json:async()=>{throw new SyntaxError('PRIVATE_BODY');}};return {status:302,headers:{get:()=> 'https://external.invalid/'}};});assert.equal(calls,1);assert.equal(result.res.code,502);assert.equal(JSON.stringify(result.logs).includes('PRIVATE'),false);if(failure==='json'){assert.equal(result.logs.find(x=>x.stage==='proxy-response').contentType,'text/html');assert.equal(result.logs.at(-1).exceptionName,'SyntaxError');}}
});
