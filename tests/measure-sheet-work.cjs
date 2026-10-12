const fs=require('node:fs'),{backend}=require('./mock-runtime.cjs'),assert=require('node:assert/strict');
function fixture(code){
  const b=backend(code);
  const student={grade:3,classNum:1,number:1,name:'가상학생1'};
  const token=b.request({action:'verifyStudent',...student}).studentToken;
  for(let n=1;n<=25;n++){
    const t=b.request({action:'verifyStudent',grade:3,classNum:1,number:n,name:'가상학생'+n}).studentToken;
    const req=p=>b.request({studentToken:t,studentKey:'3-1-'+n,...p});
    assert.equal(req({action:'saveProgress',roleModelName:'fixture',roleModelJob:'job',currentStep:10,step1:{roleModelName:'fixture'}}).success,true);
    assert.equal(req({action:'saveTests',test1Result:'good',step8:{tests:{test1:{result:'good',note:'synthetic'}}}}).success,true);
    assert.equal(req({action:'submitFinal',gemUrl:'https://example.invalid/gem',finalCareerReflection:'synthetic'}).success,true);
  }
  return {b,token,student};
}
function measure(code){
  const {b,token,student}=fixture(code),result={};
  if(process.env.PERF_ENABLE_BATCH==='1') b.enableBatch();
  const actions={
    options:{action:'getRosterOptions'},optionsWarm:{action:'getRosterOptions'},
    login:{action:'verifyStudent',...student},load:{action:'loadProgress',studentKey:'3-1-1',studentToken:token},
    save:{action:'saveProgress',studentKey:'3-1-1',studentToken:token,roleModelReason:'changed',step1:{roleModelName:'fixture',roleModelReason:'changed'}},
    tests:{action:'saveTests',studentKey:'3-1-1',studentToken:token,test1Result:'changed'},
    revision:{action:'updateRevision',studentKey:'3-1-1',studentToken:token,finalPrompt:'synthetic',revisionNote:'changed'},
    submit:{action:'submitFinal',studentKey:'3-1-1',studentToken:token,gemUrl:'https://example.invalid/gem',finalCareerReflection:'changed'},
    dashboard:{action:'getAdminDashboard',adminSecret:'test-admin-secret'},
  };
  for(const [name,payload] of Object.entries(actions)){
    b.resetStats();const data=b.request(payload);assert.equal(data.success,true,name);
    const stats=b.stats(),sum=field=>Object.values(stats.sheets).reduce((a,s)=>a+s[field],0);
    result[name]={reads:sum('reads'),batchGet:stats.batchGet,totalValueReadCalls:sum('reads')+stats.batchGet,cellsRead:sum('cells')+stats.batchCells,fullTableReads:sum('full'),writes:sum('writes'),locks:stats.locks,sheets:stats.sheets};
  }
  return result;
}
const result={fixture:'25 synthetic students with Progress/Tests/Submissions; logical Sheets calls, not service latency',after:measure()};
if(process.env.PERF_BASELINE_SOURCE)result.before=measure(fs.readFileSync(process.env.PERF_BASELINE_SOURCE,'utf8'));
if(process.env.PERF_RESULT_FILE)fs.writeFileSync(process.env.PERF_RESULT_FILE,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
