const {test}=require('node:test');const assert=require('node:assert/strict');const {backend}=require('./gas.test.cjs');
function fixture(){
 const b=backend(),token=b.login().studentToken;
 const req=p=>b.request({studentKey:'3-1-1',studentToken:token,...p});
 req({action:'saveProgress',roleModelName:'retained'});
 const sheet=b.sheets.get('Tests');sheet.appendRow(['03-01-001','UNTRUSTED LEGACY']);
 const legacy=JSON.stringify(sheet.rows[1]);return {b,req,sheet,legacy};
}
test('legacy Tests do not block Roster login or Progress restore and are absent from student/admin reads',()=>{
 const {b,req}=fixture();const auth=b.login();assert.equal(auth.success,true);assert.equal(auth.progress.roleModelName,'retained');
 for(const result of [auth,req({action:'loadProgress'}),b.request({action:'getAdminDashboard',adminSecret:'test-admin-secret'}),b.request({action:'getStudentDetail',studentKey:'3-1-1',adminSecret:'test-admin-secret'})]) assert.equal(JSON.stringify(result).includes('UNTRUSTED LEGACY'),false);
});
test('new Tests append with authenticated ownership, restore only trusted data and leave legacy untouched',()=>{
 const {b,req,sheet,legacy}=fixture();
 assert.equal(req({action:'saveTests',test1Result:'trusted',name:'forged',googleId:'forged'}).success,true);
 assert.equal(sheet.rows.length,3);assert.equal(JSON.stringify(sheet.rows[1]),legacy);
 assert.equal(sheet.rows[2][sheet.rows[0].indexOf('ownerName')],'가상학생가');
 assert.equal(sheet.rows[2][sheet.rows[0].indexOf('ownerGoogleId')],'a@example.invalid');
 assert.equal(b.login().progress.tests.test1Result,'trusted');assert.equal(JSON.stringify(b.login()).includes('UNTRUSTED LEGACY'),false);
 assert.equal(req({action:'saveTests',test2Result:'second'}).success,true);assert.equal(sheet.rows.length,3);
 assert.equal(req({action:'resetStudentData'}).success,true);assert.equal(sheet.rows.length,2);assert.equal(JSON.stringify(sheet.rows[1]),legacy);
 assert.equal(b.sheets.get('Progress').rows.length,1);assert.equal(b.login().success,true);
});
test('explicit foreign Tests identity remains blocked, including Google ID-only mismatch',()=>{
 for(const patch of [{ownerName:'다른학생'},{ownerGoogleId:'other@example.invalid'},{name:'다른학생'},{googleId:'other@example.invalid'}]){
  const {b,req,sheet}=fixture();b.context.writePatch_(sheet,2,patch);const before=JSON.stringify(sheet.rows);
  assert.equal(b.login().success,false);
  for(const action of ['loadProgress','saveTests','resetStudentData'])assert.equal(req({action}).success,false);
  assert.equal(JSON.stringify(sheet.rows),before);
 }
});
test('revision with only quarantined Tests creates an owned row without altering legacy',()=>{
 const {b,req,sheet,legacy}=fixture();assert.equal(req({action:'updateRevision',finalPrompt:'revision',revisionNote:'note'}).success,true);
 assert.equal(sheet.rows.length,3);assert.equal(JSON.stringify(sheet.rows[1]),legacy);assert.equal(b.login().progress.tests.revisionNote,'note');
});
