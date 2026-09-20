const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
const {backend}=require('./gas.test.cjs');
// Previous implementation retained only as a comparison oracle.
function previousRows(sheet,key){
 const selected=this.selectStudentRow_(sheet,key);
 return selected?[this.readTable_(sheet)[0],selected.row]:[this.readTable_(sheet)[0]];
}
const plain=value=>JSON.parse(JSON.stringify(value));
function counter(b){
 let reads=0;
 for(const sheet of b.sheets.values()){
  const original=sheet.getDataRange.bind(sheet);
  sheet.getDataRange=()=>{const range=original(),get=range.getValues;range.getValues=()=>{reads++;return get();};return range;};
 }
 return {reset(){reads=0;},get(){return reads;}};
}
function fixture(counseling){
 const b=backend();b.context.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-09-20T00:00:00Z']));}};
 const token=b.login().studentToken;
 const req=p=>b.request({studentKey:'3-1-1',studentToken:token,...p});
 req({action:'saveProgress',roleModelName:'fixture',step1:{roleModelName:'fixture'}});
 req({action:'saveTests',test1Result:'test fixture'});
 req({action:'submitFinal',finalCareerReflection:'submission fixture'});
 if(counseling)b.ss.insertSheet('Counseling').appendRow(b.context.schemas_().Counseling);
 return {b,req};
}
for(const counseling of [false,true])test(`full-read counts and identical responses; Counseling=${counseling}`,()=>{
 const {b,req}=fixture(counseling),c=counter(b),current=b.context.studentRowsForRead_;
 // Isolate the first optimization: disable request reuse for its historical comparison.
 const read=b.context.readTable_,headers=b.context.getHeaderMap;
 b.context.readTable_=sheet=>read(sheet);b.context.getHeaderMap=sheet=>headers(sheet);
 const actions=[{action:'verifyStudent',grade:3,classNum:1,number:1,name:'가상학생가'},{action:'loadProgress'},{action:'saveProgress',roleModelReason:'same'}];
 for(const payload of actions){
  b.context.studentRowsForRead_=(...args)=>previousRows.apply(b.context,args);c.reset();const before=req(payload),oldReads=c.get();
  b.context.studentRowsForRead_=current;c.reset();const after=req(payload),newReads=c.get();
  assert.equal(before.success,true);assert.equal(after.success,true);
  delete before.studentToken;delete after.studentToken;assert.deepEqual(after,before);
  const save=payload.action==='saveProgress';assert.equal(oldReads,(save?7:11)+Number(counseling));assert.equal(newReads,(save?7:8)+Number(counseling));
  console.log(`READ_COUNT ${payload.action} Counseling=${counseling}: ${oldReads} -> ${newReads}`);
 }
});
test('selected, missing and quarantined rows reuse the same header/table with reordered columns',()=>{
 const {b}=fixture(false);
 for(const name of ['Progress','Tests','Submissions']){
  const s=b.sheets.get(name);s.rows[0].push('teacherNote');s.rows[1].push('untouched');
  const duplicate=s.rows[1].slice();duplicate[0]='03-01-001';s.appendRow(duplicate);
  s.rows=s.rows.map(row=>row.slice().reverse());
 }
 const tests=b.sheets.get('Tests'),legacy=tests.rows[0].map(h=>h==='studentKey'?'3-1-2':h==='test1Result'?'untrusted':'');tests.appendRow(legacy);
 const c=counter(b),snapshot=JSON.stringify([...b.sheets].map(([n,s])=>[n,s.rows]));
 for(const name of ['Progress','Tests','Submissions'])for(const key of ['3-1-1','3-1-2','9-9-9']){
  const s=b.sheets.get(name);c.reset();const before=previousRows.call(b.context,s,key);assert.equal(c.get(),2);
  c.reset();const after=b.context.studentRowsForRead_(s,key);assert.equal(c.get(),1);assert.deepEqual(plain(after),plain(before));
 }
 assert.equal(JSON.stringify([...b.sheets].map(([n,s])=>[n,s.rows])),snapshot);
});
test('header-only sheets return the identical one-row structure with one full read',()=>{
 const b=backend(),c=counter(b);
 for(const name of ['Progress','Tests','Submissions']){
  const s=b.sheets.get(name),before=previousRows.call(b.context,s,'3-1-1');c.reset();
  const after=b.context.studentRowsForRead_(s,'3-1-1');assert.equal(c.get(),1);assert.equal(after.length,1);assert.deepEqual(plain(after),plain(before));
 }
});
test('standalone Apps Script matches the template exactly',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/utils/gasScriptTemplate.ts'),'utf8'),context={exports:{}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
 assert.equal(fs.readFileSync(path.join(__dirname,'../GoogleAppsScript.latest.gs'),'utf8'),context.exports.getGoogleAppsScriptCode());
});
