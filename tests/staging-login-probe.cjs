// One explicitly selected synthetic login wave. No student writes or automatic retries.
const fs=require('node:fs');
const {guard}=require('./staging-load.cjs');

function probeCount(value) {
  if(!['1','5','10','25'].includes(String(value)))throw Error('Choose exactly 1, 5, 10 or 25 synthetic students.');
  return Number(value);
}
async function probe(count,env=process.env,fetchImpl=fetch) {
  count=probeCount(count);
  const origin=guard(env),report={purpose:'login diagnosis only; not a production release gate',count,requests:[],completed:false};
  let runToken;
  const call=async(body,token)=>{
    const at=performance.now();
    try {
      const response=await fetchImpl(new URL('/api/staging-performance',origin),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(50000)});
      const data=await response.json(),raw=response.headers.get('x-staging-correlation-id')||'';
      const summary={stage:body.action,status:response.status,success:response.ok && data.success===true,clientMs:Math.round(performance.now()-at),correlationId:/^[0-9a-f-]{36}$/i.test(raw)?raw:null};
      if(data.performance) {
        summary.performance={};
        for(const key of ['totalMs','lockWaitMs','lockHeldMs','sheetReadMs','sheetReadCalls','sheetWriteMs','flushMs','lockTimeoutCount'])
          if(Number.isFinite(data.performance[key]) && data.performance[key]>=0)summary.performance[key]=data.performance[key];
      }
      report.requests.push(summary);return {success:summary.success,data};
    } catch(error) {
      report.requests.push({stage:body.action,status:0,success:false,clientMs:Math.round(performance.now()-at),errorKind:['TimeoutError','AbortError'].includes(error.name)?'timeout':'transport-or-json'});
      return {success:false};
    }
  };
  try {
    const start=await call({action:'startPerformanceRun'},env.STAGING_TEST_SECRET);
    if(!start.success) {report.blocker='start failed; do not restart blindly, inspect active GAS session';return report;}
    runToken=start.data.runToken;
    if(!runToken || start.data.fixture?.spreadsheetId!==env.TEST_SPREADSHEET_ID || !Array.isArray(start.data.studentTokens) || start.data.studentTokens.length!==25) {
      report.blocker='fixture or session mismatch';return report;
    }
    const rows=await Promise.all(Array.from({length:count},(_,i)=>call({action:'verifyStudent',grade:3,classNum:99,number:i+1,name:'Synthetic Student '+(i+1)},start.data.studentTokens[i])));
    report.completed=rows.every((r,i)=>r.success && r.data.student?.studentKey===`3-99-${i+1}` && r.data.student.googleId===`synthetic${i+1}@example.invalid`);
    if(!report.completed)report.blocker='login wave failed; no next wave or writes were executed';
  } finally {
    if(runToken) {
      const end=await call({action:'finishPerformanceRun'},runToken);
      report.ended=end.success && end.data.ended===true;
      if(!report.ended){report.completed=false;report.blocker='session end unconfirmed; inspect GAS active session before further tests';}
    }
  }
  return report;
}
module.exports={probeCount,probe};
if(require.main===module) {
  probe(process.argv[2]).then(report=>{
    const file=`staging-login-${report.count}-results.json`;
    fs.writeFileSync(file,JSON.stringify(report,null,2));
    console.log(`${report.completed?'PASS':'STOP'}: ${file}. Login diagnosis only, not deployment approval.`);
    if(!report.completed)process.exitCode=1;
  }).catch(()=>{console.error('Check the synthetic staging environment and student count. No secrets are printed.');process.exitCode=1;});
}
