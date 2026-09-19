const {test}=require('node:test');
const assert=require('node:assert/strict');
const {backend}=require('./gas.test.cjs');
const student={studentKey:'3-1-1',grade:3,classNum:1,number:1,name:'가상학생가',googleId:'a@example.invalid'};
const cell=(s,row,key)=>s.rows[row][s.rows[0].indexOf(key)];
const put=(s,row,key,value)=>{s.rows[row][s.rows[0].indexOf(key)]=value;};
const snapshot=b=>JSON.stringify([...b.sheets].map(([name,s])=>[name,s.rows]));
const admin=(b,p)=>b.request({adminSecret:'test-admin-secret',...p});

for(const sheetName of ['Progress','Tests','Submissions','Counseling']) {
  test(`reused studentKey: ${sheetName} blocks all reads, writes and reset without changing old data`,()=>{
    const b=backend();const oldToken=b.login().studentToken;
    let s=b.sheets.get(sheetName);
    if(!s) {s=b.ss.insertSheet(sheetName);s.appendRow(b.context.schemas_()[sheetName]);}
    const row=s.rows[0].map(h=>h==='studentKey'?'03-01-001':h==='name'?student.name:h==='googleId'?student.googleId:'private old data');
    s.appendRow(row);
    const roster=b.sheets.get('Roster');put(roster,1,'name','새학생');put(roster,1,'googleId','new@example.invalid');
    const before=snapshot(b);
    const login=b.request({action:'verifyStudent',grade:3,classNum:1,number:1,name:'새학생'});
    assert.equal(login.success,false);assert.equal(login.studentToken,undefined);
    // Exercise authorization independently of the login preflight.
    const token=b.context.issueStudentToken_({...student,name:'새학생',googleId:'new@example.invalid'});
    for(const action of ['loadProgress','getProgress','saveProgress','saveTests','updateRevision','submitFinal','submitCounseling','resetStudentData']) {
      assert.equal(b.request({action,studentKey:'3-1-1',studentToken:token,roleModelName:'overwrite'}).success,false,action);
      assert.equal(b.request({action,studentKey:'3-1-1',studentToken:oldToken}).success,false,`old token: ${action}`);
    }
    assert.equal(snapshot(b),before);
  });
}

test('legacy nameless Tests fail closed even with a named anchor; conflicting names cannot be hidden',()=>{
  const b=backend();const token=b.login().studentToken;
  b.request({action:'saveProgress',studentToken:token,studentKey:'3-1-1',roleModelName:'retained'});
  b.sheets.get('Tests').appendRow(['3-1-1','legacy result']);
  assert.equal(b.login().success,false);
  b.sheets.get('Tests').rows.pop();
  put(b.sheets.get('Progress'),1,'name','이전학생');
  assert.equal(b.login().success,false);
  assert.equal(b.request({action:'resetStudentData',studentKey:'3-1-1',studentToken:token}).success,false);
});

test('all student sheet writes survive reordered headers and preserve unknown columns',()=>{
  const b=backend();const c=b.ss.insertSheet('Counseling');c.appendRow(b.context.schemas_().Counseling);
  for(const s of b.sheets.values()) {
    const headers=s.rows[0];headers.push('teacherNote');
    for(let i=1;i<s.rows.length;i++)s.rows[i][headers.length-1]='=PRIVATE_FORMULA()';
    const order=headers.map((_,i)=>i).reverse();
    s.rows=s.rows.map(row=>order.map(i=>row[i]??''));
  }
  const token=b.login().studentToken;
  const req=p=>{const r=b.request({studentKey:'3-1-1',studentToken:token,...p});assert.equal(r.success,true,r.message);return r;};
  req({action:'saveProgress',roleModelName:'model',roleModelJob:'job',step1:{roleModelName:'model'}});
  for(const name of ['Progress','Tests','Submissions','Counseling']) {
    const s=b.sheets.get(name);if(s.rows.length>1)put(s,1,'teacherNote','=KEEP()');
  }
  req({action:'saveProgress',targetUser:'audience',step2:{targetUser:'audience'}});
  req({action:'saveProgress',speakingStyle:'kind',step3:{speakingStyle:'kind'}});
  req({action:'saveTests',test1Result:'result'});
  req({action:'updateRevision',finalPrompt:'revised',revisionNote:'note'});
  req({action:'submitFinal',gemUrl:'https://example.invalid/gem',finalCareerReflection:'reflection'});
  req({action:'submitCounseling',barrierAnswer:'answer',finalCareerReflection:'counseling'});
  const p=b.sheets.get('Progress');assert.equal(cell(p,1,'name'),student.name);assert.equal(cell(p,1,'roleModelJob'),'job');
  assert.equal(cell(p,1,'roleModelName'),'model');assert.equal(cell(p,1,'teacherNote'),'=KEEP()');
  assert.equal(cell(b.sheets.get('Tests'),1,'test1Result'),'result');
  assert.equal(cell(b.sheets.get('Submissions'),1,'finalCareerReflection'),'reflection');
  assert.equal(cell(c,1,'barrierAnswer'),'answer');
  const loaded=b.login().progress;assert.equal(loaded.stepData.step1.roleModelName,'model');assert.equal(loaded.stepData.step2.targetUser,'audience');
  assert.equal(admin(b,{action:'updateRoster',mode:'append',students:[{...student,name:student.name}]}).success,true);
  assert.equal(cell(b.sheets.get('Roster'),1,'teacherNote'),'=PRIVATE_FORMULA()');
  assert.equal(admin(b,{action:'deleteRosterStudents',students:[student]}).success,true);
  assert.equal(cell(b.sheets.get('Roster'),1,'teacherNote'),'=PRIVATE_FORMULA()');
});

test('explicit blanks stay blank with duplicates while omitted STEP data survives and admin agrees',()=>{
  const b=backend();const token=b.login().studentToken;
  const req=p=>b.request({studentKey:'3-1-1',studentToken:token,...p});
  req({action:'saveProgress',roleModelName:'old',targetUser:'keep',step1:{roleModelName:'old'},step2:{targetUser:'keep'}});
  const s=b.sheets.get('Progress');put(s,1,'updatedAt','2020-01-01');
  const newer=s.rows[1].slice();s.appendRow(newer);put(s,2,'updatedAt','2021-01-01');put(s,2,'studentKey','03-01-001');
  assert.equal(req({action:'saveProgress',roleModelName:'',step1:{roleModelName:''}}).success,true);
  assert.equal(req({action:'saveProgress',step3:{speakingStyle:'kind'}}).success,true);
  const restored=b.login().progress;
  assert.equal(restored.roleModelName,'');assert.equal(restored.stepData.step1.roleModelName,'');assert.equal(restored.stepData.step2.targetUser,'keep');
  assert.equal(s.rows.length,3);assert.equal(cell(s,1,'roleModelName'),'old');
  const dashboard=admin(b,{action:'getAdminDashboard'}).data.students.filter(x=>x.studentKey==='3-1-1');
  const detail=admin(b,{action:'getStudentDetail',studentKey:'０３-０１-００１'});
  const list=admin(b,{action:'getAllProgress'}).list.filter(x=>x.studentKey==='3-1-1');
  assert.equal(dashboard.length,1);assert.equal(dashboard[0].roleModelName,'');assert.equal(list.length,1);assert.equal(list[0].roleModelName,'');
  assert.equal(detail.success,true);assert.equal(detail.progress.stepData.step1.roleModelName,'');
});

test('logout revokes the server token and is idempotent',()=>{
  const b=backend();const token=b.login().studentToken;
  const req=action=>b.request({action,studentKey:'3-1-1',studentToken:token});
  assert.equal(req('saveProgress').success,true);assert.equal(req('logoutStudent').success,true);
  assert.equal(req('loadProgress').success,false);assert.equal(req('saveProgress').success,false);
  assert.equal(req('logoutStudent').success,true);
});

test('test/submission writes advance only the selected normalized Progress row and preserve partial submissions',()=>{
  const b=backend();const token=b.login().studentToken;
  const req=p=>b.request({studentKey:'3-1-1',studentToken:token,...p});
  req({action:'saveProgress',roleModelName:'old'});
  const s=b.sheets.get('Progress');put(s,1,'updatedAt','2020-01-01');s.appendRow(s.rows[1].slice());
  put(s,2,'studentKey','03-01-001');put(s,2,'updatedAt','2021-01-01');put(s,2,'roleModelName','latest');
  assert.equal(req({action:'saveTests',test1Result:'good'}).success,true);
  assert.equal(cell(s,1,'updatedAt'),'2020-01-01');assert.equal(b.login().progress.roleModelName,'latest');
  assert.equal(req({action:'submitFinal',gemUrl:'https://example.invalid/gem',barrierAnswer:'old',finalCareerReflection:'retain'}).success,true);
  assert.equal(req({action:'submitFinal',barrierAnswer:'',sampleQuestion1:'stale alias'}).success,true);
  const sub=b.sheets.get('Submissions');assert.equal(cell(sub,1,'barrierAnswer'),'');assert.equal(cell(sub,1,'finalCareerReflection'),'retain');
  assert.equal(cell(s,1,'updatedAt'),'2020-01-01');assert.equal(cell(s,2,'currentStep'),10);
});

test('admin configuration check fails closed for absent or mismatched GAS secret',()=>{
  const b=backend();assert.equal(admin(b,{action:'checkAdminConfig'}).success,true);
  assert.equal(b.request({action:'checkAdminConfig',adminSecret:'wrong'}).success,false);
  b.context.PropertiesService.getScriptProperties=()=>({getProperty:()=>null});
  assert.equal(admin(b,{action:'checkAdminConfig'}).success,false);
  assert.equal(admin(b,{action:'getAdminDashboard'}).success,false);
});
