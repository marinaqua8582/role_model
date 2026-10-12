const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
async function invoke(fetch) {
  const lines=[],exports={},env={STAGING_PERF_MODE:'synthetic-25',STAGING_ORIGIN:'https://staging-fixture.vercel.app',TEST_GAS_URL:'https://script.google.com/macros/s/PRIVATE_URL/exec',TEST_SPREADSHEET_ID:'PRIVATE_SHEET',STAGING_GAS_ADMIN_SECRET:'PRIVATE_ADMIN',STAGING_TEST_SECRET:'PRIVATE_START',STAGING_TOKEN_SECRET:'PRIVATE_SIGNING_SECRET_32_CHARACTERS'};
  const source=fs.readFileSync(require('node:path').join(__dirname,'../api/staging-performance.ts'),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,process:{env},Buffer,URL,AbortSignal,fetch,console:{info:s=>lines.push(JSON.parse(s))}});
  const res={status(n){this.code=n;return this;},setHeader(){},json(data){this.data=data;return this;}};
  await exports.default({method:'POST',headers:{host:'staging-fixture.vercel.app',authorization:'Bearer PRIVATE_START'},body:{action:'startPerformanceRun',name:'PRIVATE_PERSON'}},res);
  return {lines,res};
}
test('staging diagnostics identify JSON failures without body, URLs, payload or secrets',async()=>{
  const {lines,res}=await invoke(async()=>({ok:true,status:200,url:'https://script.googleusercontent.com/PRIVATE_URL',headers:{get:()=> 'text/html; charset=utf-8'},text:async()=>'<html>PRIVATE_ADMIN PRIVATE_PERSON PRIVATE_SHEET PRIVATE_START</html>'}));
  assert.equal(res.code,502);assert.ok(lines.some(x=>x.responseBytes>0));assert.ok(lines.some(x=>x.googleAppsScriptHost===true&&x.contentType==='text/html'));assert.equal(lines.at(-1).errorKind,'invalid-json');
  assert.equal(JSON.stringify(lines).includes('PRIVATE'),false);assert.equal(new Set(lines.map(x=>x.correlationId)).size,1);
  const allowed=['correlationId','stage','elapsedMs','upstreamStatus','contentType','googleAppsScriptHost','durationMs','responseBytes','exceptionName','errorKind'];for(const row of lines)for(const key of Object.keys(row))assert.ok(allowed.includes(key));
});
test('staging diagnostics sanitize exception names and do not automatically retry upstream',async()=>{
  let calls=0;const {lines,res}=await invoke(async()=>{calls++;const e=new Error('PRIVATE_ADMIN');e.name='PRIVATE_PERSON';throw e;});
  assert.equal(calls,1);assert.equal(res.code,502);assert.equal(lines.at(-1).exceptionName,'OtherError');assert.equal(JSON.stringify(lines).includes('PRIVATE'),false);
});
test('redirect tracing follows Google content GET without repeating the POST',async()=>{
  const methods=[];const {lines,res}=await invoke(async(_u,o)=>{methods.push(o.method);assert.equal(o.redirect,'manual');return methods.length===1?{ok:false,status:302,url:'https://script.google.com/macros/s/test/exec',headers:{get:()=> 'https://script.googleusercontent.com/macros/echo?private=hidden'}}:{ok:true,status:200,url:'https://script.googleusercontent.com/macros/echo',headers:{get:()=> 'application/json'},text:async()=>'{"success":false}'};});
  assert.deepEqual(methods,['POST','GET']);assert.equal(res.code,409);assert.ok(lines.some(x=>x.stage==='upstream-hop-1'));assert.equal(JSON.stringify(lines).includes('hidden'),false);
});
test('redirect tracing blocks non-Google destinations before transmitting',async()=>{
  let calls=0;const {res}=await invoke(async()=>{calls++;return {status:302,headers:{get:()=> 'https://external.invalid/'}};});assert.equal(calls,1);assert.equal(res.code,502);
});
