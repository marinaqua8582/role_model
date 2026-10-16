// Minimal, reversible fence for the unchanged v18 operating source.
const {createHash}=require('node:crypto');
const EXPECTED='dc964a545dd995b86c8f568b8829c09bdf4e152d51f7f9437b04ac112b14435b';
const helpers=String.raw`
// Operating cutover fence. No source rows are modified by these controls.
function operatingCutoverState_() {
  var raw=PropertiesService.getScriptProperties().getProperty('OPERATING_CUTOVER_V1');
  if(!raw)return {closed:false,epoch:0,closedAt:0,openedAt:0};
  var state=JSON.parse(raw);
  if(typeof state.closed!=='boolean'||!Number.isSafeInteger(state.epoch)||state.epoch<0)throw new Error('전환 상태를 확인할 수 없습니다.');
  return state;
}
function operatingCutoverRead_(action) {
  return ['getRosterOptions','verifyStudent','loadProgress','getProgress','logoutStudent','checkAdminConfig','getAdminDashboard','getStudentDetail','getAllProgress','getCutoverWriteStatus'].indexOf(action)!==-1;
}
function operatingCutoverAssert_(action,params) {
  var state=operatingCutoverState_();
  if(operatingCutoverRead_(action))return state;
  if(state.closed)throw new Error('서버 전환 점검 중입니다. 입력 내용을 보관하고 잠시 후 확인해 주세요.');
  if(state.epoch>0) {
    if(['updateRoster','deleteRosterStudents'].indexOf(action)!==-1)throw new Error('전환 후 명단 변경은 새 운영 앱에서 진행해 주세요.');
    if(CacheService.getScriptCache().get('operating-epoch:'+String(params.studentToken||''))!==String(state.epoch))throw new Error('전환 이전 학생 세션입니다. 다시 로그인해 주세요.');
  }
  return state;
}
function getOperatingCutoverStatus() {
  var state=operatingCutoverState_();
  console.log(JSON.stringify({closed:state.closed,epoch:state.epoch,closedAt:state.closedAt,openedAt:state.openedAt}));
  return state;
}
function closeWritesForCutover() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(30000))throw new Error('진행 중 요청이 있습니다. 쓰기 차단을 확정하지 않았습니다.');
  try {
    var state=operatingCutoverState_();
    if(!state.closed){state={closed:true,epoch:state.epoch+1,closedAt:Date.now(),openedAt:state.openedAt};PropertiesService.getScriptProperties().setProperty('OPERATING_CUTOVER_V1',JSON.stringify(state));}
    SpreadsheetApp.flush();
    console.log(JSON.stringify({closed:true,epoch:state.epoch,closedAt:state.closedAt,admittedWritersDrained:true}));
    return state;
  }finally{lock.releaseLock();}
}
function reopenWritesAfterRollback() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(30000))throw new Error('진행 중 요청 확인이 필요합니다.');
  try {
    var state=operatingCutoverState_();
    if(state.closed){state={closed:false,epoch:state.epoch+1,closedAt:state.closedAt,openedAt:Date.now()};PropertiesService.getScriptProperties().setProperty('OPERATING_CUTOVER_V1',JSON.stringify(state));}
    console.log(JSON.stringify({closed:false,epoch:state.epoch,freshStudentLoginRequired:true,rosterWritesRemainBlocked:true}));
    return state;
  }finally{lock.releaseLock();}
}
`;
function patchSource(source){
  if(source.includes('function operatingCutoverState_'))throw Error('Already patched');
  const begin=source.indexOf('function handleRequest(e) {'),end=source.indexOf('function studentKey_(',begin);
  if(begin<0||end<begin)throw Error('Source router changed');
  const prefix=source.slice(0,begin),suffix=source.slice(end);source=source.slice(begin,end);
  const edits=[
    ["if (action !== 'getRosterOptions' && action !== 'checkAdminConfig') {","if (true) { // All requests share the cutover admission fence."],
    ['    initSheetsIfNeeded(ss);',"    var operatingState=operatingCutoverAssert_(action,params);\n    if(!operatingState.closed)initSheetsIfNeeded(ss);"],
    ["action === 'checkAdminConfig' ||","action === 'getCutoverWriteStatus' ||\n      action === 'checkAdminConfig' ||"],
    ["} else if (action === 'checkAdminConfig') {","} else if (action === 'getCutoverWriteStatus') {\n      result=Object.assign({success:true},operatingCutoverState_());\n    } else if (action === 'checkAdminConfig') {"],
    ['      result = verifyStudent(ss, params, readContext);',"      result = verifyStudent(ss, params, readContext);\n      if(result.success&&result.studentToken)CacheService.getScriptCache().put('operating-epoch:'+result.studentToken,String(operatingCutoverState_().epoch),21600);"],
    ['    output.setContent(JSON.stringify(result));',"    result.cutoverFence='operating-cutover-v1';\n    result.writesClosed=operatingCutoverState_().closed;\n    output.setContent(JSON.stringify(result));"],
    ['    output.setContent(JSON.stringify({ success: false, message: err.message || err.toString() }));',"    output.setContent(JSON.stringify({success:false,message:err.message||err.toString(),cutoverFence:'operating-cutover-v1',writesClosed:operatingCutoverState_().closed}));"]
  ];
  for(const [before,after]of edits){if(source.split(before).length!==2)throw Error('Source shape changed');source=source.replace(before,after);}
  return prefix+source+suffix+'\n'+helpers;
}
function preparePinned(source){
  const canonical=source.replace(/\r\n/g,'\n').trimEnd();
  if(createHash('sha256').update(canonical).digest('hex')!==EXPECTED)throw Error('Operating source differs; stop');
  return patchSource(canonical+'\n');
}
module.exports={patchSource,preparePinned,EXPECTED,helpers};
