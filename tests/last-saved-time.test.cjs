const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, mount, prepare, nextButton, writes, header, bar, renderer, component } = require('./ui-harness.cjs');
const { act } = renderer;
const old = '2026-08-21T10:41:58.000Z';
const latest = '2026-09-26T12:00:00.000Z';
const cases = [
  ['Progress newer than submission', {progress:{updatedAt:latest},submittedAt:old}, latest],
  ['submission newest', {progress:{updatedAt:old},submittedAt:latest}, latest],
  ['Tests newest', {progress:{updatedAt:old},tests:{testedAt:latest},submittedAt:old}, latest],
  ['raw updatedAt newest', {progress:{updatedAt:old},updatedAt:latest,submittedAt:old}, latest],
  ['empty and malformed ignored', {progress:{updatedAt:'invalid-date'},updatedAt:'',testedAt:latest,submittedAt:'not-a-date'}, latest],
  ['timezone offsets compared as instants', {progress:{updatedAt:'2026-09-26T15:00:00+09:00'},updatedAt:'2026-09-26T08:00:00Z'}, '2026-09-26T08:00:00.000Z'],
];
for (const [name, raw, expected] of cases) test(`last saved: ${name}`, () => {
  const c=runtime(); const input=JSON.stringify(raw);
  assert.equal(c.api.mapFullStudentDetail(raw).updatedAt,expected);
  assert.equal(JSON.stringify(raw),input);
});
for (const [name,raw] of [['all dates absent',{}],['all dates invalid',{progress:{updatedAt:'bad'},updatedAt:' ',testedAt:'bad',submittedAt:'bad'}]]) {
  test(`last saved: ${name} uses current-time fallback`,()=>{
    const c=runtime();const start=Date.now();const date=c.api.mapFullStudentDetail(raw).updatedAt;const end=Date.now();
    assert.ok(Number.isFinite(Date.parse(date)));assert.ok(Date.parse(date)>=start&&Date.parse(date)<=end);
  });
}
for(let step=1;step<=7;step++) test(`STEP${step}: Header time changes only after single save succeeds`,async()=>{
  const {c,tree}=await mount(step,{completed:step===7});await prepare(tree,step);
  const before=header(c,tree).currentStudent.updatedAt;
  // Ensure the completion instant is distinguishable from the initial snapshot.
  while(Date.now()<=Date.parse(before)) await new Promise(resolve=>setTimeout(resolve,1));
  let release,pending;c.state.deferred=new Promise(resolve=>release=resolve);
  await act(async()=>{pending=nextButton(tree).props.onClick();});
  assert.equal(header(c,tree).currentStudent.updatedAt,before);
  assert.equal(bar(c,tree).currentStep,step);
  const responseStart=Date.now();
  await act(async()=>{release();await pending;});
  const after=header(c,tree).currentStudent;
  assert.notEqual(after.updatedAt,before);
  assert.ok(Date.parse(after.updatedAt)>=responseStart&&Date.parse(after.updatedAt)<=Date.now());
  assert.equal(bar(c,tree).currentStep,step+1);
  assert.equal(after.currentStep,step===7?10:step+1);
  assert.equal(writes(c).length,1);assert.equal(writes(c)[0].action,'saveProgress');
  assert.equal(header(c,tree).saveStatus,'saved');
  await act(async()=>tree.unmount());
});
for(const failure of ['server','network']) test(`last saved: ${failure} rejection preserves time and screen`,async()=>{
  const {c,tree}=await mount(2);const before=header(c,tree).currentStudent.updatedAt;
  c.state.failure=failure;
  await act(async()=>{await nextButton(tree).props.onClick();});
  assert.equal(header(c,tree).currentStudent.updatedAt,before);assert.equal(bar(c,tree).currentStep,2);
  assert.equal(writes(c).length,1);
  await act(async()=>tree.unmount());
});
test('navigation metadata failure does not update time; successful retry does',async()=>{
  const {c,tree}=await mount(2);const before=header(c,tree).currentStudent.updatedAt;
  c.state.failure='server';
  await act(async()=>{await tree.root.findByType(component(c,2)).props.onNext();});
  assert.equal(header(c,tree).currentStudent.updatedAt,before);assert.equal(bar(c,tree).currentStep,2);
  c.state.failure=null;const start=Date.now();
  await act(async()=>{await tree.root.findByType(component(c,2)).props.onNext();});
  assert.ok(Date.parse(header(c,tree).currentStudent.updatedAt)>=start);assert.equal(bar(c,tree).currentStep,3);
  await act(async()=>tree.unmount());
});
