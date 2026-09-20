const {test}=require('node:test');const assert=require('node:assert/strict');const {backend}=require('./gas.test.cjs');
function fixture(counseling=false,uncached=false){
 const b=backend();b.context.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-09-20T00:00:00Z']));}};
 if(uncached){const read=b.context.readTable_,map=b.context.getHeaderMap;b.context.readTable_=sheet=>read(sheet);b.context.getHeaderMap=sheet=>map(sheet);}
 const token=b.login().studentToken,req=p=>b.request({studentKey:'3-1-1',studentToken:token,...p});
 req({action:'saveProgress',roleModelName:'fixture',step1:{roleModelName:'fixture',competencyCustom:'custom'},step2:{targetUser:'preserve'}});
 req({action:'saveTests',test1Result:'test',step8:{tests:{test1:{result:'good',note:'note'}}}});
 req({action:'submitFinal',finalCareerReflection:'reflection'});
 if(counseling)b.ss.insertSheet('Counseling').appendRow(b.context.schemas_().Counseling);
 return {b,req,token};
}
function counters(b){
 let counts={};
 for(const [name,sheet] of b.sheets){const full=sheet.getDataRange.bind(sheet),range=sheet.getRange.bind(sheet);
  sheet.getRange=(...args)=>{const r=range(...args),read=r.getValues,write=r.setValues;
   r.getValues=()=>{const key=name+':'+(r.full?'full':'header');counts[key]=(counts[key]||0)+1;return read();};
   r.setValues=v=>{counts[name+':write']=(counts[name+':write']||0)+1;return write(v);};return r;};
  sheet.getDataRange=()=>{const r=full();r.full=true;return r;};
 }
 return {reset(){counts={};},all(){return {...counts};},total(){return Object.entries(counts).filter(([k])=>k.endsWith(':full')).reduce((sum,[,v])=>sum+v,0);}};
}
const creds={action:'verifyStudent',grade:3,classNum:1,number:1,name:'가상학생가'};
for(const counseling of [false,true])test(`request reuse reads each sheet once, preserves full responses and save path; Counseling=${counseling}`,()=>{
 const old=fixture(counseling,true),fresh=fixture(counseling),oc=counters(old.b),nc=counters(fresh.b);
 for(const p of [creds,{action:'loadProgress'},{action:'getProgress'},{action:'saveProgress',roleModelReason:'changed'}]){
  oc.reset();nc.reset();const before=old.req(p),after=fresh.req(p);assert.deepEqual(after,before);assert.equal(after.success,true);
  const save=p.action==='saveProgress';assert.equal(oc.total(),(save?5:8)+Number(counseling));assert.equal(nc.total(),(save?5:4)+Number(counseling));
  if(save)assert.deepEqual(nc.all(),oc.all());
  else for(const [key,count] of Object.entries(nc.all())){assert.equal(key.endsWith(':full'),true);assert.equal(count,1,key);}
  console.log(`REQUEST_READ_COUNT ${p.action} Counseling=${counseling}: ${oc.total()} -> ${nc.total()}`);
 }
});
test('request cache never survives a request, write, roster change or logout',()=>{
 const {b,req,token}=fixture();assert.equal(req({action:'loadProgress'}).data.roleModelName,'fixture');
 assert.equal(req({action:'saveProgress',roleModelName:'new',step1:{roleModelName:''}}).success,true);
 let p=req({action:'loadProgress'}).data;assert.equal(p.roleModelName,'new');assert.equal(p.stepData.step1.roleModelName,'');
 const roster=b.sheets.get('Roster');roster.rows[1][3]='다른학생';assert.equal(req({action:'loadProgress'}).success,false);
 roster.rows[1][3]='가상학생가';assert.equal(req({action:'loadProgress'}).success,true);
 assert.equal(b.request({action:'logoutStudent',studentToken:token}).success,true);assert.equal(req({action:'loadProgress'}).success,false);
});
test('cached and uncached reads agree on reordered columns, duplicates, blanks and legacy rows',()=>{
 const a=fixture(true,true),b=fixture(true);
 for(const f of [a,b]){
  for(const name of ['Progress','Tests','Submissions']){const s=f.b.sheets.get(name);s.rows[0].push('teacherNote');s.rows[1].push('keep');
   const row=s.rows[1].slice();row[0]='03-01-001';s.appendRow(row);
   s.rows=s.rows.map(r=>r.slice().reverse());
  }
  const t=f.b.sheets.get('Tests');t.appendRow(t.rows[0].map(h=>h==='studentKey'?'3-1-1':h==='test1Result'?'legacy-hidden':''));
  assert.equal(f.req({action:'saveProgress',roleModelName:'',step1:{roleModelName:''}}).success,true);
 }
 for(const p of [creds,{action:'loadProgress'}]){const x=a.req(p),y=b.req(p);assert.deepEqual(y,x);assert.equal(JSON.stringify(y).includes('legacy-hidden'),false);}
 for(const f of [a,b]){const s=f.b.sheets.get('Tests');s.rows[1][s.rows[0].indexOf('ownerGoogleId')]='other@example.invalid';}
 assert.deepEqual(a.req({action:'loadProgress'}),b.req({action:'loadProgress'}));assert.equal(b.req({action:'loadProgress'}).success,false);
});
test('administrator and write requests never receive a read context',()=>{
 const {b,req}=fixture();const read=b.context.readTable_,map=b.context.getHeaderMap;
 b.context.readTable_=(sheet,ctx)=>{assert.equal(ctx,undefined);return read(sheet);};
 b.context.getHeaderMap=(sheet,ctx)=>{assert.equal(ctx,undefined);return map(sheet);};
 for(const p of [{action:'saveProgress',roleModelReason:'new'},{action:'saveTests',test1Result:'new'},{action:'updateRevision',revisionNote:'new'},{action:'submitFinal',finalCareerReflection:'new'},{action:'getAdminDashboard',adminSecret:'test-admin-secret'},{action:'getStudentDetail',adminSecret:'test-admin-secret'}])assert.equal(req(p).success,true);
});
test('empty/legacy-only Tests and missing Progress keep identical restoration responses',()=>{
 const old=fixture(false,true),fresh=fixture(false);
 for(const f of [old,fresh]){
  f.b.sheets.get('Progress').rows.splice(1);f.b.sheets.get('Tests').rows.splice(1);f.b.sheets.get('Submissions').rows.splice(1);
  f.b.sheets.get('Tests').appendRow(['3-1-1','legacy-hidden']);
 }
 for(const p of [creds,{action:'loadProgress'}]){const x=old.req(p),y=fresh.req(p);assert.deepEqual(y,x);assert.equal(y.success,true);assert.equal(JSON.stringify(y).includes('legacy-hidden'),false);}
});
