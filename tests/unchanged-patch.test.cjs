const {test}=require('node:test'),assert=require('node:assert/strict');
const {backend}=require('./mock-runtime.cjs');
function fixture(){
  const b=backend(),token=b.request({action:'verifyStudent',grade:3,classNum:1,number:1,name:'가상학생1'}).studentToken;
  const request=p=>b.request({studentKey:'3-1-1',studentToken:token,...p});
  assert.equal(request({action:'saveProgress',roleModelName:'same'}).success,true);
  const s=b.sheets.get('Progress');
  b.context.requestReadContext_={studentKey:'3-1-1',tables:{},headerMaps:{},emptySheets:{}};
  b.context.readTable_(s);b.resetStats();
  return {b,s,request};
}
test('unchanged own-row patch makes no reads or writes and keeps its request snapshot',()=>{
  const {b,s}=fixture();
  assert.equal(b.context.writePatch_(s,2,{roleModelName:'same'}),2);
  assert.equal(s.stats.reads,0);assert.equal(s.stats.writes,0);
  assert.ok(b.context.requestReadContext_.tables.Progress);
});
test('changed patch writes while preserving unknown cells and another student row',()=>{
  const {b,s}=fixture();s.rows[0].push('teacherFormula');s.rows[1].push('=KEEP()');
  const other=s.rows[1].slice();other[0]='3-1-2';s.rows.push(other.slice());
  b.context.writePatch_(s,2,{roleModelName:'changed'});
  assert.equal(s.stats.writes,1);assert.equal(s.rows[1][6],'changed');
  assert.equal(s.rows[1].at(-1),'=KEEP()');assert.deepEqual(s.rows[2],other);
  assert.equal(b.context.requestReadContext_.tables.Progress,undefined);
});
test('unchanged patch never hides duplicate physical headers',()=>{
  const {b,s}=fixture();s.rows[0].push('roleModelName');
  assert.throws(()=>b.context.writePatch_(s,2,{roleModelName:'same'},s.rows[0].slice()),/중복/);
  assert.equal(s.stats.writes,0);
});
test('without a request snapshot a patch is written rather than guessed unchanged',()=>{
  const {b,s}=fixture();b.context.requestReadContext_=undefined;
  b.context.writePatch_(s,2,{roleModelName:'same'});assert.equal(s.stats.writes,1);
});
