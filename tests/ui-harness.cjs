const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const renderer = require('react-test-renderer');
const { backend } = require('./gas.test.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '..');
const credentials = { grade: 3, classNum: 1, number: 1, name: '가상학생가' };
const names = ['RoleModel', 'Purpose', 'Personality', 'ResponseStyle', 'SafetyRules', 'FinalPrompt', 'GeminiGuide', 'ChatbotTest', 'PromptRevision', 'Submission'];
const plain = value => JSON.parse(JSON.stringify(value));
function runtime(sourceRoot = root) {
  const b = backend();
  const storage = new Map(), session = new Map(), modules = new Map(), listeners = new Map();
  const state = { calls: [], failure: null, deferred: null, admin: false, preview: null };
  const store = map => ({ getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) });
  const window = {
    addEventListener(type, cb) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(cb); },
    removeEventListener(type, cb) { listeners.get(type)?.delete(cb); },
    dispatchEvent(event) { listeners.get(event.type)?.forEach(cb => cb(event)); },
    confirm: () => true, scrollTo() {},
  };
  const context = vm.createContext({ console, URL, AbortSignal, setTimeout, clearTimeout, window,
    localStorage: store(storage), sessionStorage: store(session),
    Event: class { constructor(type) { this.type = type; } },
    fetch: async (url, options = {}) => {
      const payload = JSON.parse(options.body || '{}');
      state.calls.push({ url, payload });
      let data;
      if (url === '/api/gas-proxy') {
        if (payload.action === 'saveProgress') {
          if (state.deferred) await state.deferred;
          if (state.failure === 'network') throw new Error('mock offline');
          if (state.failure === 'server') return { ok: true, status: 200, json: async () => ({ success: false, message: 'mock 저장 실패' }) };
        }
        data = b.request(payload);
      } else if (url === '/api/admin/session') data = { authenticated: state.admin };
      else if (url === '/api/roster/options') data = { success: true, grades: [3], classes: [1], numbers: [1, 2] };
      else if (url === '/api/admin/dashboard') data = { success: true, data: { students: [], roster: [], stats: {} } };
      else if (url.startsWith('/api/admin/student-detail?')) data = { success: true, data: state.preview };
      else throw new Error(`Unexpected mocked URL: ${url}`);
      return { ok: true, status: 200, json: async () => data };
    },
  });
  function load(relative) {
    const filename = path.resolve(sourceRoot, relative);
    if (modules.has(filename)) return modules.get(filename).exports;
    const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta', '({env:{}})');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    const module = { exports: {} }; modules.set(filename, module);
    const requireLocal = specifier => {
      if (specifier === 'canvas-confetti') return () => {};
      if (!specifier.startsWith('.')) return require(specifier);
      const base = path.resolve(path.dirname(filename), specifier);
      const resolved = ['.ts', '.tsx', '/index.ts'].map(ext => base + ext).find(file => fs.existsSync(file));
      if (!resolved) throw new Error(`Unresolved module: ${specifier}`);
      return load(path.relative(sourceRoot, resolved));
    };
    vm.runInContext('(function(require,module,exports){' + compiled + '\n})', context)(requireLocal, module, module.exports);
    return module.exports;
  }
  return { b, state, storage, session, window, load, api: load('src/api/client.ts') };
}
function fixture(c, progress, step) {
  const p = plain(progress), n = c.load('src/utils/normalizer.ts');
  p.currentStep = step;
  Object.assign(p.step1, { roleModelName: ' 가상 롤모델 ', roleModelJob: ' 직업 ', roleModelReason: ' 이유 ', jobDescription: ' 업무 ', careerHistory: ' 경력 ', challengeExperience: ' 도전 ', competencies: [n.COMPETENCY_OPTIONS[0]], competencyCustom: ' 직접 역량 ', strengths: [n.STRENGTH_OPTIONS[0]], strengthCustom: ' 직접 강점 ', values: [n.VALUE_OPTIONS[0]], valueCustom: ' 직접 가치 ' });
  Object.assign(p.step2, { chatbotPurposes: [n.PURPOSE_OPTIONS[0]], targetUser: '기타', targetUserCustom: ' 직접 대상 ', expectedOutcome: ' 기대 ' });
  Object.assign(p.step3, { personalities: n.PERSONALITY_OPTIONS.slice(0, 2), speakingStyle: ' 따뜻하게 ', honorificStyle: '친근한 존댓말', desiredFeeling: ' 느낌 ' });
  Object.assign(p.step4, { answerLength: 'medium', answerElements: [n.COMPOSITION_OPTIONS[0]] });
  Object.assign(p.step5, { agreedToRules: true, quizPassed: true, allRulesChecked: true, checkedFactualityRules: Array(5).fill(true), checkedSafetyRules: Array(4).fill(true), checkedDisclaimer: true, quizAnswer: 'C' });
  Object.assign(p.step6, { chatbotName: ' 가상 멘토 ', initialPrompt: ' 초기 ', revisedPrompt: ' 수정 ', finalPrompt: ' 최종 ', isConfirmed: true });
  for (const key of Object.keys(p.step8.tests)) p.step8.tests[key] = { result: 'good', note: '보존할 메모' };
  Object.assign(p.step10, { gemUrl: 'https://gemini.google.com/gem/mock', barrierAnswer: '답변1', barrierReflection: '성찰1', decisionAnswer: '답변2', decisionReflection: '성찰2', educationAnswer: '답변3', educationReflection: '성찰3', finalCareerReflection: '가상의 상담을 통해 다양한 진로를 탐색하고 나의 흥미와 강점을 생각해 보았습니다.' });
  if (step < 9) p.step6.revisedPrompt = '';
  for (const n of [1,2,3,4,5,6,8,10]) if (n > step) p[`step${n}`] = plain(progress[`step${n}`]);
  return p;
}
const component = (c, n) => c.load(`src/components/student/Step${n}${names[n - 1]}.tsx`)[`Step${n}${names[n - 1]}`];
const textOf = node => typeof node === 'string' ? node : (node.children || []).map(textOf).join('');
const buttons = tree => tree.root.findAllByType('button');
const nextButton = tree => buttons(tree).filter(b => /다음 항목|다음 STEP|다음 단계|다음으로|저장 및 이동|다시 시도|프롬프트 확정|Gem 제작 완료|STEP 9\)로 이동|STEP 9\)으로 이동|제출\(STEP 10\)로 이동/.test(textOf(b))).at(-1);
const writes = c => c.state.calls.filter(x => ['saveProgress', 'saveTests', 'updateRevision', 'submitFinal'].includes(x.payload.action)).map(x => plain(x.payload));
const header = (c, tree) => tree.root.findByType(c.load('src/components/common/Header.tsx').Header).props;
const bar = (c, tree) => tree.root.findByType(c.load('src/components/common/StepProgressBar.tsx').StepProgressBar).props;
async function mount(step, { completed = false, sourceRoot } = {}) {
  const c = runtime(sourceRoot);
  const auth = await c.api.verifyStudentAuth(credentials);
  const p = fixture(c, auth.progress, completed ? 10 : step);
  if (completed) { p.currentStep = 10; p.isFinalSubmitted = true; p.step10.submittedAt = '2026-01-01T00:00:00.000Z'; }
  const token = JSON.parse(c.storage.get('rolemodel_chatbot_student_session')).token;
  const seedPayload = { ...p, action: 'saveProgress', studentToken: token };
  for (const n of [1,2,3,4,5,6,8,10]) if (n > p.currentStep) delete seedPayload[`step${n}`];
  const seed = c.b.request(seedPayload);
  if (!seed.success) throw new Error(JSON.stringify(seed));
  if (completed) {
    const submission = c.b.request({ action: 'submitFinal', studentKey: p.studentKey, studentToken: token, ...p.step10 });
    if (!submission.success) throw new Error(JSON.stringify(submission));
  }
  c.storage.set('rolemodel_chatbot_progress_map', JSON.stringify({ [p.studentKey]: p }));
  c.storage.delete('rolemodel_current_student_key');
  let tree;
  await renderer.act(async () => { tree = renderer.create(React.createElement(c.load('src/App.tsx').default)); });
  await renderer.act(async () => { tree.root.findByType(c.load('src/components/student/StudentAuth.tsx').StudentAuth).props.onAuthenticated(p); });
  if (completed && step !== 10) await renderer.act(async () => { bar(c, tree).onStepClick(step); });
  c.state.calls.length = 0;
  return { c, p, tree };
}
async function prepare(tree, step) {
  if (step === 1) for (let i = 0; i < 2; i++) await renderer.act(async () => { await nextButton(tree).props.onClick(); });
  if (step === 5) await renderer.act(async () => { buttons(tree).find(b => textOf(b).includes('C. “제가 대신')).props.onClick(); });
  if (step === 6) {
    const checks = buttons(tree).filter(b => /롤모델 정보\(인물|챗봇의 진로 멘토링 목적|원하는 성격과 말투|답변 길이와 구성 요소|거짓\/환각을 방지|진로를 대신 결정하지/.test(textOf(b)));
    if (checks.length !== 6) throw new Error(`Expected 6 checklist controls, got ${checks.length}`);
    for (const b of checks) await renderer.act(async () => { b.props.onClick(); });
  }
}
module.exports = { runtime, fixture, mount, prepare, component, nextButton, writes, header, bar, textOf, buttons, plain, React, renderer, credentials };
