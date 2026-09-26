const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, fixture, mount, prepare, component, nextButton, writes, header, bar, textOf, plain, React, renderer, credentials } = require('./ui-harness.cjs');
const { act } = renderer;
const stored = c => JSON.parse(c.storage.get('rolemodel_chatbot_progress_map'))['3-1-1'];
const close = tree => act(async () => tree.unmount());
for (let step = 1; step <= 7; step++) {
  test(`STEP${step} Next: one real client saveProgress, answers + destination, React/storage/backend agree`, async () => {
    const { c, tree } = await mount(step);
    await prepare(tree, step);
    const before = plain(header(c, tree).currentStudent);
    const token = JSON.parse(c.storage.get('rolemodel_chatbot_student_session')).token;
    const rawProgress = () => c.b.request({ action: 'loadProgress', studentKey: '3-1-1', studentToken: token }).data;
    const serverBefore = plain(rawProgress().stepData);
    const button = nextButton(tree); assert.ok(button); assert.equal(Boolean(button.props.disabled), false);
    let release, pending;
    c.state.deferred = new Promise(resolve => release = resolve);
    await act(async () => { pending = button.props.onClick(); });
    assert.equal(writes(c).length, 1);
    assert.equal(bar(c, tree).currentStep, step);
    assert.equal(tree.root.findByType('fieldset').props.disabled, true);
    assert.equal(stored(c).currentStep, step);
    await act(async () => { release(); await pending; });
    const requests = writes(c);
    assert.equal(requests.length, 1); assert.equal(requests[0].action, 'saveProgress');
    assert.equal(requests[0].currentStep, step + 1);
    if (step <= 6) assert.deepEqual(requests[0][`step${step}`], before[`step${step}`]);
    assert.equal(bar(c, tree).currentStep, step + 1);
    assert.equal(header(c, tree).currentStudent.currentStep, step + 1);
    assert.equal(header(c, tree).saveStatus, 'saved');
    assert.equal(tree.root.findByType('fieldset').props.disabled, false);
    assert.equal(stored(c).currentStep, step + 1);
    c.state.deferred = null;
    const restored = await c.api.loadStudentProgress('3-1-1');
    assert.equal(restored.success, true); assert.equal(restored.progress.currentStep, step + 1);
    assert.equal(restored.progress.googleId, before.googleId);
    // Flat fields retain their previous serializer, including whitespace/custom-array rules.
    if (step === 1) {
      assert.equal(requests[0].roleModelName, before.step1.roleModelName.trim());
      assert.equal(requests[0].roleModelReason, before.step1.roleModelReason.trim());
      assert.ok(requests[0].competencies.includes('직접 역량'));
      assert.ok(requests[0].strengths.includes('직접 강점'));
      assert.ok(requests[0].values.includes('직접 가치'));
    }
    if (step === 2) { assert.equal(requests[0].targetUser, '직접 대상'); assert.equal(requests[0].expectedOutcome, '기대'); }
    if (step === 3) { assert.deepEqual(requests[0].personality, before.step3.personalities); assert.equal(requests[0].speakingStyle, '따뜻하게'); }
    if (step === 4) assert.equal(requests[0].answerLength, '4~6문장');
    if (step === 6) assert.equal(requests[0].finalPrompt, before.step6.finalPrompt.trim());
    // Saving a step does not erase the unrelated steps or the final draft.
    const serverAfter = plain(rawProgress().stepData);
    for (const key of Object.keys(serverBefore)) if (key !== `step${step}`) {
      assert.deepEqual(serverAfter[key], serverBefore[key]);
    }
    await close(tree);
  });
  for (const failure of ['server', 'network']) test(`STEP${step} ${failure} failure stays on page, retains input/cache and permits retry`, async () => {
    const { c, tree } = await mount(step); await prepare(tree, step);
    const before = plain(header(c, tree).currentStudent), cache = c.storage.get('rolemodel_chatbot_progress_map');
    c.state.failure = failure;
    await act(async () => { await nextButton(tree).props.onClick(); });
    assert.equal(writes(c).length, 1);
    assert.equal(bar(c, tree).currentStep, step);
    assert.deepEqual(plain(header(c, tree).currentStudent), before);
    assert.equal(c.storage.get('rolemodel_chatbot_progress_map'), cache);
    assert.notEqual(header(c, tree).saveStatus, 'saved');
    assert.match(textOf(tree.root), /실패/);
    assert.equal(tree.root.findByType('fieldset').props.disabled, false);
    c.state.failure = null;
    await act(async () => { await nextButton(tree).props.onClick(); });
    assert.equal(writes(c).length, 2); assert.equal(bar(c, tree).currentStep, step + 1);
    await close(tree);
  });
  test(`STEP${step} same-tick double click sends one save and waits for the response`, async () => {
    const { c, tree } = await mount(step); await prepare(tree, step);
    let release, pending;
    c.state.deferred = new Promise(resolve => release = resolve);
    const click = nextButton(tree).props.onClick;
    await act(async () => { pending = click(); await click(); });
    assert.equal(writes(c).length, 1); assert.equal(bar(c, tree).currentStep, step);
    await act(async () => { release(); await pending; });
    assert.equal(writes(c).length, 1); assert.equal(bar(c, tree).currentStep, step + 1);
    await close(tree);
  });
  test(`STEP${step} completed student keeps currentStep 10 and submission`, async () => {
    const { c, tree } = await mount(step, { completed: true }); await prepare(tree, step);
    const submitted = plain((await c.api.loadStudentProgress('3-1-1')).progress.step10);
    await act(async () => { await nextButton(tree).props.onClick(); });
    assert.equal(writes(c).length, 1); assert.equal(writes(c)[0].currentStep, 10);
    assert.equal(header(c, tree).currentStudent.currentStep, 10); assert.equal(stored(c).currentStep, 10);
    const restored = await c.api.loadStudentProgress('3-1-1');
    assert.equal(restored.progress.currentStep, 10); assert.equal(restored.progress.isFinalSubmitted, true);
    assert.deepEqual(plain(restored.progress.step10), submitted);
    await close(tree);
  });
}
test('previous/top/jump navigation still saves answers then metadata, and blocks unreached steps', async () => {
  for (const kind of ['previous', 'top', 'jump']) {
    const { c, tree } = await mount(6);
    const before = plain(header(c, tree).currentStudent.step6);
    await act(async () => { bar(c, tree).onStepClick(9); });
    assert.equal(writes(c).length, 0); assert.equal(bar(c, tree).currentStep, 6);
    await act(async () => {
      const props = tree.root.findByType(component(c, 6)).props;
      if (kind === 'previous') props.onPrev();
      else if (kind === 'jump') props.onJumpToStep(3);
      else bar(c, tree).onStepClick(3);
    });
    assert.equal(writes(c).length, 2);
    assert.deepEqual(writes(c)[0].step6, before);
    assert.equal('step6' in writes(c)[1], false);
    assert.equal(header(c, tree).currentStudent.currentStep, 6);
    assert.equal(bar(c, tree).currentStep, kind === 'previous' ? 5 : 3);
    await close(tree);
  }
});
test('navigation without a component save still persists metadata; metadata failure stays and reports error', async () => {
  const { c, tree } = await mount(2);
  c.state.failure = 'server';
  await act(async () => { await tree.root.findByType(component(c, 2)).props.onNext(); });
  assert.equal(writes(c).length, 1); assert.equal(writes(c)[0].currentStep, 3);
  assert.equal(bar(c, tree).currentStep, 2); assert.equal(header(c, tree).saveStatus, 'error');
  c.state.failure = null;
  await act(async () => { await tree.root.findByType(component(c, 2)).props.onNext(); });
  assert.equal(writes(c).length, 2); assert.equal(bar(c, tree).currentStep, 3);
  await close(tree);
});
test('session revoked while save awaits: no navigation, no cache repopulation', async () => {
  const { c, tree } = await mount(2); await prepare(tree, 2);
  let release, pending; c.state.deferred = new Promise(resolve => release = resolve);
  await act(async () => { pending = nextButton(tree).props.onClick(); });
  await act(async () => { c.api.clearStudentSession(); release(); await pending; });
  assert.equal(bar(c, tree).currentStep, 2); assert.equal(c.storage.has('rolemodel_chatbot_progress_map'), false);
  assert.equal(writes(c).length, 1); assert.match(textOf(tree.root), /실패/);
  await close(tree);
});
for (const step of [8, 9, 10]) test(`STEP${step} original action flow is unchanged`, async () => {
  const { c, tree } = await mount(step);
  await act(async () => {
    if (step === 10) await tree.root.findByType('form').props.onSubmit({ preventDefault() {} });
    else await nextButton(tree).props.onClick();
  });
  assert.deepEqual(writes(c).map(r => r.action), step === 8 ? ['saveTests', 'saveProgress'] : step === 9 ? ['updateRevision', 'saveProgress'] : ['submitFinal']);
  assert.equal(bar(c, tree).currentStep, Math.min(step + 1, 10));
  if (step === 10) assert.equal(header(c, tree).currentStudent.isFinalSubmitted, true);
  await close(tree);
});
test('admin preview: top/Next remain read only, no student write actions', async () => {
  const { c, tree, p } = await mount(7);
  c.state.admin = true; c.state.preview = p;
  // Existing App admin session can be activated through its real login callback.
  await act(async () => { header(c, tree).onOpenAdminLogin(); });
  const login = c.load('src/components/admin/AdminLogin.tsx').AdminLogin;
  await act(async () => { tree.root.findByType(login).props.onLoginSuccess(); });
  const list = c.load('src/components/admin/AdminStudentList.tsx').AdminStudentList;
  await act(async () => { await tree.root.findByType(list).props.onPreviewStudentMode(p); });
  assert.equal(header(c, tree).isPreviewMode, true);
  c.state.calls.length = 0;
  await act(async () => { bar(c, tree).onStepClick(7); });
  await act(async () => { await nextButton(tree).props.onClick(); });
  assert.equal(bar(c, tree).currentStep, 8); assert.equal(writes(c).length, 0);
  await close(tree);
});
for (let step = 1; step <= 7; step++) test(`STEP${step} read-only component does not save or claim saved navigation`, async () => {
  const c = runtime(); const { progress } = await c.api.verifyStudentAuth(credentials); const p = fixture(c, progress, step);
  let readOnly = false, next = [];
  function Wrapper() {
    const [data, setData] = React.useState(p[`step${step}`]);
    return React.createElement(component(c, step), { data, student: p, roleModel: p.step1, purpose: p.step2, personality: p.step3, responseStyle: p.step4, promptData: p.step6, isReadOnly: readOnly, onChange: setData, onNext: saved => next.push(saved), onPrev() {}, onJumpToStep() {} });
  }
  let tree; await act(async () => { tree = renderer.create(React.createElement(Wrapper)); });
  await prepare(tree, step);
  readOnly = true; await act(async () => { tree.update(React.createElement(Wrapper)); });
  c.state.calls.length = 0;
  await act(async () => { await nextButton(tree).props.onClick(); });
  assert.equal(writes(c).length, 0); assert.deepEqual(next, [undefined]);
  await close(tree);
});

for (let step = 1; step <= 7; step++) test(`STEP${step} keeps its save guard until the async navigation callback finishes`, async () => {
  const c = runtime(); const { progress } = await c.api.verifyStudentAuth(credentials); const p = fixture(c, progress, step);
  let release, pending, nextCalls = 0;
  const navigation = new Promise(resolve => release = resolve);
  function Wrapper() {
    const [data, setData] = React.useState(p[`step${step}`]);
    return React.createElement(component(c, step), { data, student: p, roleModel: p.step1, purpose: p.step2, personality: p.step3, responseStyle: p.step4, promptData: p.step6, onChange: setData, onNext: async saved => { assert.equal(saved, true); nextCalls++; await navigation; }, onPrev() {}, onJumpToStep() {} });
  }
  let tree; await act(async () => { tree = renderer.create(React.createElement(Wrapper)); });
  await prepare(tree, step); c.state.calls.length = 0;
  const click = nextButton(tree).props.onClick;
  await act(async () => { pending = click(); });
  assert.equal(nextCalls, 1); assert.match(textOf(tree.root), /저장 중/);
  await act(async () => { await click(); }); assert.equal(writes(c).length, 1);
  await act(async () => { release(); await pending; });
  assert.doesNotMatch(textOf(tree.root), /저장 중/); await close(tree);
});
for (let step = 1; step <= 6; step++) test(`STEP${step} optional destination changes only currentStep in its serialized payload`, async () => {
  const c = runtime(); const { progress } = await c.api.verifyStudentAuth(credentials); const p = fixture(c, progress, step);
  c.state.calls.length = 0;
  const save = c.api[`saveStep${step}Progress`];
  assert.equal((await save(p, p[`step${step}`])).success, true);
  assert.equal((await save(p, p[`step${step}`], step + 1)).success, true);
  const [before, after] = writes(c);
  assert.equal(before.currentStep, step); assert.equal(after.currentStep, step + 1);
  delete before.currentStep; delete after.currentStep;
  assert.deepEqual(after, before);
});

