const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
const {backend}=require('./gas.test.cjs');
function client(b) {
  const storage=new Map(); const modules=new Map();
  const state={fail:false,negative:false,calls:[],deferred:null};
  const context={console:{...console,warn(){},error(){}},Event:class{constructor(type){this.type=type}},window:{dispatchEvent(){}},
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    sessionStorage:{getItem:()=>null,removeItem(){}},
    fetch:async(url,options)=>{
      state.calls.push({url,payload:JSON.parse(options?.body||'{}')});
      if(state.fail)throw new Error('offline');
      if(state.deferred)await state.deferred;
      return {ok:true,status:200,json:async()=>state.negative?{success:false,message:'저장 실패'}:b.request(JSON.parse(options.body))};
    }};
  vm.createContext(context);
  function load(relative){
    const filename=path.resolve(__dirname,'..',relative);
    if(modules.has(filename))return modules.get(filename).exports;
    const source=fs.readFileSync(filename,'utf8').replaceAll('import.meta','({env:{}})');
    const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
    const module={exports:{}};modules.set(filename,module);
    const requireLocal=specifier=> {
      if (!specifier.startsWith('.')) return require(specifier);
      const base=path.resolve(path.dirname(filename),specifier);
      const resolved=['.ts','.tsx','/index.ts'].map(ext=>base+ext).find(file=>fs.existsSync(file));
      return load(path.relative(path.resolve(__dirname,'..'),resolved));
    };
    const fn=vm.runInContext('(function(require,module,exports){'+compiled+'\n})',context);
    fn(requireLocal,module,module.exports);return module.exports;
  }
  return {api:load('src/api/client.ts'),storage,state,load};
}
const credentials={grade:3,classNum:1,number:1,name:'가상학생가'};
test('real client and generated GAS round-trip steps and exact custom fields across devices',async()=>{
  const b=backend();const a=client(b);const auth=await a.api.verifyStudentAuth(credentials);assert.equal(auth.success,true);
  const p=auth.progress;
  p.step1.roleModelName='테스트 모델';p.step1.competencyCustom='직접 쓴 역량';
  assert.equal((await a.api.saveStep1Progress(p,p.step1)).success,true);
  p.step2.targetUser='기타';p.step2.targetUserCustom='직접 쓴 대상';p.step2.purposeSummarySentence='직접 쓴 문장';
  assert.equal((await a.api.saveStep2Progress(p,p.step2)).success,true);
  p.step5.quizAnswer='C';p.step5.checkedSafetyRules=[true,false,true];
  assert.equal((await a.api.saveStep5Progress(p,p.step5)).success,true);
  const device2=client(b);const restored=await device2.api.verifyStudentAuth(credentials);
  assert.equal(restored.progress.step1.competencyCustom,'직접 쓴 역량');
  assert.equal(restored.progress.step2.targetUser,'기타');assert.equal(restored.progress.step2.targetUserCustom,'직접 쓴 대상');
  assert.equal(restored.progress.step2.purposeSummarySentence,'직접 쓴 문장');assert.equal(restored.progress.step5.checkedSafetyRules[1],false);
  assert.equal(b.sheets.get('Progress').rows.length,2);
});
test('network and server failures never become save success or offline login',async()=>{
  const b=backend();const c=client(b);const auth=await c.api.verifyStudentAuth(credentials);const p=auth.progress;
  for(const failure of ['fail','negative']) {
    c.state[failure]=true;
    assert.equal((await c.api.saveStep1Progress(p,p.step1)).success,false);
    assert.equal((await c.api.saveTests(p,p.step8)).success,false);
    assert.equal((await c.api.updateRevision(p,p.step6,p.step8)).success,false);
    assert.equal((await c.api.submitFinal(p,p.step10,p)).success,false);
    await assert.rejects(()=>c.api.saveStudentProgress(p));
    assert.equal((await c.api.verifyStudentAuth(credentials)).success,false);
    c.state[failure]=false;
  }
  assert.equal(b.sheets.get('Progress').rows.length,1);
  assert.equal(c.state.calls.some(x=>x.url==='/api/student/save-step'),false);
});
test('logout removes A data and pending response cannot repopulate the next session',async()=>{
  const b=backend();const c=client(b);const a=await c.api.verifyStudentAuth(credentials);
  let release;c.state.deferred=new Promise(resolve=>release=resolve);
  const pending=c.api.saveStep1Progress(a.progress,a.progress.step1);
  assert.equal(c.api.isStudentSaving(),true);c.api.clearStudentSession();release();
  assert.equal((await pending).success,false);assert.equal(c.api.isStudentSaving(),false);
  assert.equal(c.storage.has('rolemodel_chatbot_progress_map'),false);
  c.state.deferred=null;
  const other=await c.api.verifyStudentAuth({...credentials,number:2,name:'가상학생나'});
  assert.equal(other.progress.googleId,'b@example.invalid');assert.equal(other.progress.step1.roleModelName,'');
  assert.equal(JSON.stringify([...c.storage]).includes('a@example.invalid'),false);
});
test('navigation saves only metadata and cannot erase saved answers with a stale full snapshot',async()=>{
  const b=backend();const c=client(b);const {progress:p}=await c.api.verifyStudentAuth(credentials);
  p.step2.expectedOutcome='보존되는 내용';await c.api.saveStep2Progress(p,p.step2);
  p.step2.expectedOutcome='';p.currentStep=4;await c.api.saveStudentProgress(p);
  const restored=await c.api.loadStudentProgress(p.studentKey);
  assert.equal(restored.progress.step2.expectedOutcome,'보존되는 내용');
  const last=c.state.calls.at(-2).payload;assert.equal('step2' in last,false);
});

test('STEP7 renders the current full Google ID; admin report still renders',async()=>{
  const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
  const b=backend();const c=client(b);const {progress:p}=await c.api.verifyStudentAuth(credentials);
  const {Step7GeminiGuide}=c.load('src/components/student/Step7GeminiGuide.tsx');
  const html=renderToStaticMarkup(React.createElement(Step7GeminiGuide,{promptData:p.step6,student:p,onNext(){},onPrev(){}}));
  assert.equal(html.includes('a@example.invalid'),true);assert.equal(html.includes('b@example.invalid'),false);
  const {AdminPrintView}=c.load('src/components/admin/AdminPrintView.tsx');
  const report=renderToStaticMarkup(React.createElement(AdminPrintView,{studentsToPrint:[p],title:'테스트 보고서',onBack(){}}));
  assert.equal(report.includes('가상학생가'),true);
});
