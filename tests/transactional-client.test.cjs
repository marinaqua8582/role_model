const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function client(url) {
  const storage=new Map(),modules=new Map(),state={drop:false,calls:[]};
  const context={AbortSignal,setTimeout,clearTimeout,console,Event:class{},window:{dispatchEvent(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:()=>null,removeItem(){}},fetch:async(relative,options)=>{
    const p=JSON.parse(options?.body||'{}');state.calls.push(p.action);const response=await fetch(url+relative,options);
    if(state.drop&&p.action==='saveProgress'){await response.json();state.drop=false;throw Error('simulated response loss after durable commit');}return response;
  }};
  vm.createContext(context);
  function load(relative){const filename=path.resolve(__dirname,'..',relative);if(modules.has(filename))return modules.get(filename).exports;const source=fs.readFileSync(filename,'utf8').replaceAll('import.meta','({env:{}})');const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;const module={exports:{}};modules.set(filename,module);const requireLocal=s=>{if(!s.startsWith('.'))return require(s);const base=path.resolve(path.dirname(filename),s),resolved=['.ts','.tsx','/index.ts'].map(e=>base+e).find(fs.existsSync);return load(path.relative(path.resolve(__dirname,'..'),resolved));};vm.runInContext('(function(require,module,exports){'+compiled+'\n})',context)(requireLocal,module,module.exports);return module.exports;}
  return {api:load('src/api/client.ts'),load,storage,state};
}
test('real student client uses durable HTTP backend for 25 save/relogin/final paths',async t=>{
  const {startLocal}=await import('../transactional/local-server.mjs'),{fixture}=await import('../transactional/store.mjs');const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'role-client-')),app=await startLocal({file:path.join(dir,'client.sqlite')});t.after(async()=>{await app.close();fs.rmSync(dir,{recursive:true,force:true});});
  const clients=fixture.map(()=>client(app.url));let progress=[];
  await t.test('25 real clients save exact step fields and render only own full ID',async()=>{
    const auth=await Promise.all(clients.map((c,i)=>c.api.verifyStudentAuth(fixture[i])));auth.forEach(r=>assert.equal(r.success,true));progress=auth.map(r=>r.progress);
    const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
    await Promise.all(clients.map(async(c,i)=>{const p=progress[i];p.step1.roleModelName=`실제클라이언트${i}`;p.step1.competencyCustom=`직접입력${i}`;assert.equal((await c.api.saveStep1Progress(p,p.step1)).success,true);p.step2.targetUserCustom=`대상${i}`;assert.equal((await c.api.saveStep2Progress(p,p.step2)).success,true);assert.equal((await c.api.saveTests(p,p.step8)).success,true);const {Step7GeminiGuide}=c.load('src/components/student/Step7GeminiGuide.tsx');const html=renderToStaticMarkup(React.createElement(Step7GeminiGuide,{promptData:p.step6,student:p,onNext(){},onPrev(){}}));assert.ok(html.includes(fixture[i].googleId));fixture.forEach((s,j)=>{if(i!==j)assert.ok(!html.includes(s.googleId));});}));
  });
  await t.test('relogin restores exact fields, new final submission and admin share the source',async()=>{
    await Promise.all(clients.map(async(c,i)=>{const auth=await c.api.verifyStudentAuth(fixture[i]);assert.equal(auth.progress.step1.competencyCustom,`직접입력${i}`);assert.equal(auth.progress.step2.targetUserCustom,`대상${i}`);const submission={...auth.progress.step10,gemUrl:'https://example.invalid/'+i,finalCareerReflection:`학생화면최종${i}`};assert.equal((await c.api.submitFinal(auth.progress,submission,auth.progress)).success,true);const restored=await c.api.fetchStudentProgress(fixture[i].studentKey);assert.equal(restored.step10.finalCareerReflection,`학생화면최종${i}`);assert.equal(restored.isFinalSubmitted,true);const server=await app.service.read(fixture[i].studentKey);assert.equal(server.finalCareerReflection,restored.step10.finalCareerReflection);}));
  });
  await t.test('actual client response loss blocks new writes, receipt confirms without retransmission',async()=>{
    const c=clients[0],p=await c.api.fetchStudentProgress(fixture[0].studentKey);c.state.drop=true;const before=c.state.calls.filter(a=>a==='saveProgress').length;
    assert.equal((await c.api.saveStep1Progress(p,p.step1)).success,false);assert.equal(c.api.hasUncertainSave(),true);
    assert.equal((await c.api.saveStep1Progress(p,p.step1)).success,false);assert.equal(c.state.calls.filter(a=>a==='saveProgress').length,before+1);
    assert.equal((await c.api.confirmPendingSave()).state,'completed');assert.equal(c.api.hasUncertainSave(),false);
    assert.equal((await c.api.saveStep1Progress(p,p.step1)).success,true);
  });
  await t.test('two real screens conflict safely and require an explicit reload',async()=>{
    const c=clients[0],other=client(app.url),auth=await other.api.verifyStudentAuth(fixture[0]);
    const p=await c.api.fetchStudentProgress(fixture[0].studentKey);p.step1.roleModelName='새 화면 답안';assert.equal((await c.api.saveStep1Progress(p,p.step1)).success,true);
    auth.progress.step1.roleModelName='오래된 화면';const conflict=await other.api.saveStep1Progress(auth.progress,auth.progress.step1);assert.equal(conflict.success,false);assert.match(conflict.message,/다른 화면/);assert.equal(other.api.hasUncertainSave(),false);
    const fresh=await other.api.fetchStudentProgress(fixture[0].studentKey);assert.equal(fresh.step1.roleModelName,'새 화면 답안');assert.equal((await other.api.saveStep1Progress(fresh,fresh.step1)).success,true);
  });
});
