const {test}=require('node:test'),assert=require('node:assert/strict');
const {runtime,React,renderer,textOf}=require('./ui-harness.cjs');
const {act}=renderer;
test('lazy student screen exposes only own full Google ID and preserves the copy button',async()=>{
  const c=runtime(),auth=await c.api.verifyStudentAuth({grade:3,classNum:1,number:1,name:'가상학생가'});
  const Component=c.load('src/components/student/Step7GeminiGuide.tsx').Step7GeminiGuide;
  let tree;
  await act(async()=>{tree=renderer.create(React.createElement(Component,{promptData:auth.progress.step6,student:auth.student,onNext(){},onPrev(){}}));});
  const html=textOf(tree.root);
  assert.ok(html.includes('a@example.invalid'));assert.equal(html.includes('b@example.invalid'),false);
  assert.ok(tree.root.findAllByType('button').some(button=>/복사/.test(textOf(button))));
  await act(async()=>{await tree.root.findAllByType('button').find(button=>/Google ID 복사/.test(textOf(button))).props.onClick();});
  assert.deepEqual(c.state.copied,['a@example.invalid']);
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,2050));});
  await act(async()=>tree.unmount());
});
