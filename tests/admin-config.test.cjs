const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const path=require('node:path');
const {backend}=require('./gas.test.cjs');
function server(b,env) {
  const cache={};let calls=0;
  function load(file) {
    if(cache[file])return cache[file];
    const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const exports={};cache[file]=exports;
    vm.runInNewContext(source,{exports,process:{env},Buffer,Date,console,require:id=>id==='../_lib.js'?load('api/_lib.ts'):require(id),fetch:async(url,options)=>{calls++;return {text:async()=>JSON.stringify(b.request(JSON.parse(options.body)))};}});
    return exports;
  }
  return {handler:load('api/admin/login.ts').default,calls:()=>calls};
}
test('admin login validates Vercel/GAS secret before issuing session, without exposing it',async()=>{
  for(const secret of [undefined,'wrong','test-admin-secret']) {
    const b=backend();const s=server(b,{ADMIN_PASSWORD:'password',ADMIN_API_SECRET:secret,GAS_URL:'https://example.invalid/gas'});
    const res={code:0,headers:{},status(code){this.code=code;return this;},json(body){this.body=body;return this;},setHeader(k,v){this.headers[k]=v;}};
    await s.handler({method:'POST',body:{password:'password'}},res);
    assert.equal(res.code,secret==='test-admin-secret'?200:503);
    assert.equal(Boolean(res.headers['Set-Cookie']),secret==='test-admin-secret');
    assert.equal(JSON.stringify(res.body).includes('test-admin-secret'),false);
    if(!secret)assert.equal(s.calls(),0);
  }
});
