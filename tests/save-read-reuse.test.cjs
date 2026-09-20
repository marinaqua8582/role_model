const {test}=require('node:test');const assert=require('node:assert/strict');const {backend}=require('./gas.test.cjs');
function fixture(old=false,counseling=false,seed=true){
 const b=backend();b.context.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-09-20T00:00:00Z']));}};
 if(old){const save=b.context.saveProgress;b.context.saveProgress=(ss,p)=>save(ss,p);}
 const token=b.login().studentToken,req=p=>b.request({studentKey:'3-1-1',studentToken:token,...p});
 if(seed){req({action:'saveProgress',roleModelName:'fixture',targetUser:'keep',currentStep:10,step1:{roleModelName:'fixture'},step2:{targetUser:'keep'}});req({action:'submitFinal',finalCareerReflection:'keep submission'});}
 if(counseling)b.ss.insertSheet('Counseling').appendRow(b.context.schemas_().Counseling);
 return {b,req,token};
}
function counts(b){
 let stats={},internal=false;const add=k=>stats[k]=(stats[k]||0)+1;
 const lookup=b.ss.getSheetByName;b.ss.getSheetByName=n=>{add('getSheetByName');return lookup(n);};b.context.SpreadsheetApp.flush=()=>add('flush');
 for(const [name,s] of b.sheets){
  const full=s.getDataRange.bind(s),range=s.getRange.bind(s),max=s.getMaxColumns.bind(s);
  for(const method of ['getLastRow','getLastColumn']){const f=s[method].bind(s);s[method]=()=>{if(!internal)add(method);return f();};}
  s.getMaxColumns=()=>{internal=true;try{return max();}finally{internal=false;}};
  s.getRange=(...args)=>{const r=range(...args),read=r.getValues,write=r.setValues;
   r.getValues=()=>{add(name+':'+(r.full?'full':'header'));return read();};r.setValues=v=>{add('setValues');return write(v);};return r;};
  s.getDataRange=()=>{internal=true;try{const r=full();r.full=true;return r;}finally{internal=false;}};
 }
 return {reset(){stats={};},all(){return {...stats};},full(){return Object.entries(stats).filter(([k])=>k.endsWith(':full')).reduce((sum,[,v])=>sum+v,0);}};
}
const rows=b=>JSON.parse(JSON.stringify([...b.sheets].map(([n,s])=>[n,s.rows])));
for(const counseling of [false,true])test(`save full-read and write counts with identical output; Counseling=${counseling}`,()=>{
 const old=fixture(true,counseling),fresh=fixture(false,counseling),oc=counts(old.b),nc=counts(fresh.b);
 const payload={action:'saveProgress',roleModelReason:'new',step1:{roleModelReason:'new'}};
 const before=old.req(payload),after=fresh.req(payload);assert.equal(after.success,true);assert.deepEqual(after,before);assert.deepEqual(rows(fresh.b),rows(old.b));
 assert.equal(oc.full(),7+Number(counseling));assert.equal(nc.full(),5+Number(counseling));assert.equal(nc.all().setValues,oc.all().setValues);assert.equal(nc.all().flush,1);
 console.log('SAVE_COUNTS '+JSON.stringify({counseling,before:oc.all(),after:nc.all()}));
 for(const p of [{action:'verifyStudent',grade:3,classNum:1,number:1,name:'가상학생가'},{action:'loadProgress'}])assert.deepEqual(fresh.req(p),old.req(p));
});
test('save preserves blanks, omitted fields, stepData, completion and submission on shuffled headers',()=>{
 const old=fixture(true),fresh=fixture();
 for(const f of [old,fresh]){const s=f.b.sheets.get('Progress');s.rows[0].push('teacherNote');s.rows[1].push('=KEEP_FORMULA()');s.rows=s.rows.map(r=>r.slice().reverse());}
 for(const p of [{action:'saveProgress',roleModelName:'',step1:{roleModelName:''},currentStep:1},{action:'saveProgress',speakingStyle:'kind',step3:{speakingStyle:'kind'}}])assert.deepEqual(fresh.req(p),old.req(p));
 assert.deepEqual(rows(fresh.b),rows(old.b));const p=fresh.req({action:'loadProgress'}).data;
 assert.equal(p.roleModelName,'');assert.equal(p.targetUser,'keep');assert.equal(p.stepData.step1.roleModelName,'');assert.equal(p.stepData.step2.targetUser,'keep');assert.equal(p.currentStep,10);assert.equal(p.submission.finalCareerReflection,'keep submission');assert.equal(p.googleId,'a@example.invalid');
 const s=fresh.b.sheets.get('Progress');assert.equal(s.rows[1][s.rows[0].indexOf('teacherNote')],'=KEEP_FORMULA()');
});
test('new rows extend headers safely and repeated requests do not create duplicates',()=>{
 const old=fixture(true,false,false),fresh=fixture(false,false,false);
 for(const p of [{action:'saveProgress',step1:{roleModelName:'new'}},{action:'saveProgress',roleModelReason:'again'}])assert.deepEqual(fresh.req(p),old.req(p));
 assert.deepEqual(rows(fresh.b),rows(old.b));const s=fresh.b.sheets.get('Progress');assert.equal(s.rows.length,2);assert.equal(s.rows[1][s.rows[0].indexOf('ownerName')],'가상학생가');assert.equal(s.rows[1][s.rows[0].indexOf('ownerGoogleId')],'a@example.invalid');
});
test('owner is written to the actual selected duplicate even if timestamp ordering changes after save',()=>{
 const {b,req}=fixture();const s=b.sheets.get('Progress'),col=n=>s.rows[0].indexOf(n);
 s.rows[1][col('updatedAt')]='2030-01-01';const selected=s.rows[1].slice();selected[col('updatedAt')]='2040-01-01';selected[col('studentKey')]='03-01-001';selected[col('writtenFields')]='';selected[col('ownerName')]='';selected[col('ownerGoogleId')]='';s.appendRow(selected);
 const untouched=JSON.stringify(s.rows[1]);assert.equal(req({action:'saveProgress',roleModelName:''}).success,true);
 assert.equal(JSON.stringify(s.rows[1]),untouched);assert.equal(s.rows[2][col('ownerName')],'가상학생가');assert.equal(s.rows[2][col('ownerGoogleId')],'a@example.invalid');
 const fields=JSON.parse(s.rows[2][col('writtenFields')]).fields;assert.ok(fields.includes('rolemodelname'));assert.equal(s.rows[2][col('roleModelName')],'');
});
test('save rejection for foreign ownership and expired token does not change rows',()=>{
 const {b,req,token}=fixture();const s=b.sheets.get('Progress');s.rows[1][s.rows[0].indexOf('ownerGoogleId')]='other@example.invalid';const before=rows(b);
 assert.equal(req({action:'saveProgress',roleModelName:'attack'}).success,false);assert.deepEqual(rows(b),before);
 b.request({action:'logoutStudent',studentToken:token});assert.equal(req({action:'saveProgress'}).success,false);assert.deepEqual(rows(b),before);
});
test('write exceptions never produce save success and the lock is released',()=>{
 const {b,req}=fixture();const s=b.sheets.get('Progress'),range=s.getRange.bind(s);
 s.getRange=(...a)=>{const r=range(...a);r.setValues=()=>{throw Error('simulated write failure');};return r;};
 assert.equal(req({action:'saveProgress',roleModelName:'fail'}).success,false);assert.equal(b.state.locked,false);
});
