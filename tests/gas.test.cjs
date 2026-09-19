const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/gasScriptTemplate.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleContext = { exports: {} };
vm.runInNewContext(compiled, moduleContext);
const code = moduleContext.exports.getGoogleAppsScriptCode();

class Sheet {
  constructor(name) { this.name = name; this.rows = []; this.maxColumns = 26; }
  getName() { return this.name; }
  getMaxColumns() { return Math.max(this.maxColumns, this.getLastColumn()); }
  insertColumnsAfter(after, count) { this.maxColumns = after + count; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map(r => r.length)); }
  getRange(r, c, nr = 1, nc = 1) {
    return {
      getValues: () => Array.from({length:nr}, (_,i) => Array.from({length:nc}, (_,j) => this.rows[r+i-1]?.[c+j-1] ?? '')),
      setValues: values => { values.forEach((row,i) => row.forEach((v,j) => { this.rows[r+i-1] ||= []; this.rows[r+i-1][c+j-1] = v; })); },
      setValue: value => { this.rows[r-1] ||= []; this.rows[r-1][c-1] = value; },
    };
  }
  getDataRange() { return this.getRange(1,1,this.getLastRow(),this.getLastColumn()); }
  appendRow(row) { this.rows.push(Array.from(row)); }
  deleteRow(index) { this.rows.splice(index-1,1); }
}
function backend() {
  const sheets = new Map(); const cache = new Map(); let id = 0;
  const ss = { getSheetByName: name => sheets.get(name), insertSheet: name => { const sheet = new Sheet(name); sheets.set(name,sheet); return sheet; } };
  const state = { locked:false, denyLock:false, acquired:0, released:0 };
  const context = {
    SpreadsheetApp: {getActiveSpreadsheet: () => ss, flush() {}},
    ContentService: {MimeType:{JSON:'json'},createTextOutput:()=>({setMimeType(){}, setContent(text){this.text=text;}})},
    PropertiesService: { getScriptProperties:()=>({getProperty:()=> 'test-admin-secret'}) },
    CacheService: {getScriptCache:()=>({put:(k,v)=>cache.set(k,v),get:k=>cache.get(k),remove:k=>cache.delete(k)})},
    Utilities: {getUuid:()=>String(++id)},
    LockService: {getScriptLock:()=>({tryLock(){if(state.denyLock)return false;assert.equal(state.locked,false);state.locked=true;state.acquired++;return true;},hasLock:()=>state.locked,releaseLock(){state.locked=false;state.released++;}})},
  };
  vm.createContext(context); vm.runInContext(code,context); context.initSheetsIfNeeded(ss);
  sheets.get('Roster').appendRow([3,1,1,'가상학생가','a@example.invalid']);
  sheets.get('Roster').appendRow([3,1,2,'가상학생나','b@example.invalid']);
  const request = params => JSON.parse(context.handleRequest({postData:{contents:JSON.stringify(params)}}).text);
  const login = (number=1) => request({action:'verifyStudent',grade:3,classNum:1,number,name:number===1?' 가상 학생가 ':'가상학생나'});
  return {sheets,context,ss,state,request,login,cache};
}

test('generated Apps Script preserves Korean whitespace matching and key normalization',()=>{
  const b=backend(); const a=b.login(); assert.equal(a.success,true); assert.equal(a.student.studentKey,'3-1-1');
  assert.equal(b.context.studentKey_('０３- ０１-００１'),'3-1-1');
  assert.throws(()=>b.context.studentKey_('3-1-1x'));
});
test('steps 1/2/3 and repeated requests update one row; restore retains other steps',()=>{
  const b=backend(); const token=b.login().studentToken;
  const save = payload=>b.request({action:'saveProgress',studentKey:'03-01-001',studentToken:token,...payload});
  assert.equal(save({roleModelName:'테스트 롤모델',currentStep:2,step1:{roleModelName:'테스트 롤모델',competencyCustom:'직접 입력'}}).success,true);
  for(let i=0;i<10;i++) assert.equal(save({currentStep:3,targetUser:'대상',step2:{targetUser:'대상',purposeSummarySentence:'목적'}}).success,true);
  assert.equal(save({currentStep:4,personality:['친절'],step3:{personalities:['친절']}}).success,true);
  assert.equal(save({currentStep:1,roleModelJob:'직업'}).success,true);
  assert.equal(b.sheets.get('Progress').rows.length,2);
  const restored=b.login().progress;
  assert.equal(restored.roleModelName,'테스트 롤모델'); assert.equal(restored.targetUser,'대상'); assert.equal(restored.currentStep,4);
  assert.equal(restored.stepData.step1.competencyCustom,'직접 입력'); assert.equal(restored.stepData.step2.purposeSummarySentence,'목적');
  assert.equal(b.state.acquired,b.state.released);
});
test('duplicate rows choose newest data and merge same-identity missing fields without deleting',()=>{
  const b=backend(); const token=b.login().studentToken;
  b.request({action:'saveProgress',studentToken:token,studentKey:'3-1-1',roleModelName:'옛 값',targetUser:'보존'});
  const sheet=b.sheets.get('Progress'); const old=sheet.rows[1];old[29]='2025-01-01';
  const latest=old.slice();latest[0]='03-01-001';latest[6]='최근 값';latest[16]='';latest[29]='2026-01-01';
  // This scenario represents legacy rows without explicit-write metadata.
  latest[sheet.rows[0].indexOf('writtenFields')]='';
  sheet.appendRow(latest);
  const loaded=b.login().progress;assert.equal(loaded.roleModelName,'최근 값');assert.equal(loaded.targetUser,'보존');
  b.request({action:'saveProgress',studentToken:token,studentKey:'3-1-1',expectedOutcome:'추가'});
  assert.equal(sheet.rows.length,3); assert.equal(sheet.rows[1][6],'옛 값');assert.equal(sheet.rows[2][17],'추가');
});
test('lock timeout and exceptions return failure and release any acquired lock',()=>{
  const b=backend();const token=b.login().studentToken;b.state.denyLock=true;
  assert.equal(b.request({action:'saveProgress',studentToken:token,studentKey:'3-1-1'}).success,false);
  assert.equal(b.sheets.get('Progress').rows.length,1);
  b.state.denyLock=false;
  assert.equal(b.request({action:'saveProgress',studentToken:token,studentKey:'bad'}).success,false);
  assert.equal(b.state.acquired,b.state.released);
});
test('student A cannot read or write B; own full Google ID survives re-login',()=>{
  const b=backend();const a=b.login();
  assert.equal(a.student.googleId,'a@example.invalid');
  assert.equal(b.request({action:'loadProgress',studentKey:'3-1-2',studentToken:a.studentToken}).success,false);
  assert.equal(b.request({action:'saveProgress',studentKey:'3-1-2',studentToken:a.studentToken}).success,false);
  assert.equal(b.request({action:'loadProgress',studentKey:'3-1-1'}).success,false);
  assert.equal(b.login(2).student.googleId,'b@example.invalid');
  const options=JSON.stringify(b.request({action:'getRosterOptions'}));assert.equal(options.includes('@'),false);assert.equal(options.includes('가상학생'),false);
  assert.equal(b.request({action:'getStudentDetail',studentKey:'3-1-1'}).success,false);
});
test('tests, revision and submission persist and are idempotent',()=>{
  const b=backend();const token=b.login().studentToken;
  const request=p=>b.request({studentToken:token,studentKey:'3-1-1',...p});
  assert.equal(request({action:'saveProgress',roleModelName:'모델',currentStep:8}).success,true);
  assert.equal(request({action:'saveTests',test1Result:'잘 작동함',step8:{tests:{test1:{result:'good',note:'메모'}}}}).success,true);
  assert.equal(request({action:'updateRevision',currentStep:9,finalPrompt:'수정',step6:{finalPrompt:'수정'},revisionNote:'개선'}).success,true);
  const loaded=b.login().progress;
  assert.equal(loaded.tests.test1Result,'잘 작동함');assert.equal(loaded.tests.step8.tests.test1.note,'메모');assert.equal(loaded.stepData.step6.finalPrompt,'수정');
  for(let i=0;i<2;i++) assert.equal(request({action:'submitFinal',gemUrl:'https://gemini.google.com/gem/test',finalCareerReflection:'가상의 성찰'}).success,true);
  assert.equal(b.sheets.get('Submissions').rows.length,2);assert.equal(b.login().progress.isFinalSubmitted,true);
});
test('translation opt-out is present in the source document',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(html,/<html lang="ko" translate="no">/);assert.match(html,/<meta name="google" content="notranslate"/);
});

test('administrator dashboard, detail and roster add/delete retain existing progress',()=>{
  const b=backend();const token=b.login().studentToken;
  b.request({action:'saveProgress',studentToken:token,studentKey:'3-1-1',step2:{purposeSummarySentence:'관리자 상세 확인'},targetUser:'대상'});
  const admin=p=>b.request({adminSecret:'test-admin-secret',...p});
  assert.equal(admin({action:'getAdminDashboard'}).success,true);
  const detail=admin({action:'getStudentDetail',studentKey:'3-1-1'});assert.equal(detail.success,true);
  assert.equal(detail.progress.stepData.step2.purposeSummarySentence,'관리자 상세 확인');
  assert.equal(admin({action:'updateRoster',mode:'append',students:[{grade:3,classNum:2,number:1,name:'가상학생다',googleId:'c@example.invalid'}]}).success,true);
  assert.equal(admin({action:'deleteRosterStudents',students:[{grade:3,classNum:2,number:1}]}).success,true);
  assert.equal(b.sheets.get('Roster').rows.length,3);assert.equal(b.sheets.get('Progress').rows.length,2);
});

module.exports = { backend };
