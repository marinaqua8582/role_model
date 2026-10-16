// Protected staging only; never resubmit unknown writes.
const fs=require('node:fs'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
function guard(env=process.env) {
  if(env.STAGING_CONFIRM!=='SYNTHETIC_25_ONLY' || !env.STAGING_URL || !env.STAGING_TEST_SECRET || !env.TEST_SPREADSHEET_ID) throw Error('Explicit synthetic staging URL, confirmation, secret and spreadsheet ID are required.');
  const url=new URL(env.STAGING_URL);
  if(url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || !/^staging-[a-z0-9-]+\.vercel\.app$/.test(url.hostname)) throw Error('Only a dedicated staging-*.vercel.app origin is permitted.');
  return url;
}

function summarize(rows) {
  const times=rows.map(r=>r.ms).sort((a,b)=>a-b), success=rows.filter(r=>r.data?.success).length;
  return {count:rows.length,mean:times.reduce((a,b)=>a+b,0)/times.length,p50:times[Math.ceil(times.length*.5)-1],p95:times[Math.ceil(times.length*.95)-1],max:times.at(-1),successRate:success/rows.length,timeouts:rows.filter(r=>r.timeout).length,lockFailures:rows.reduce((n,r)=>n+(r.data?.performance?.lockTimeoutCount||0),0),performance:rows.map(r=>r.data?.performance||null)};
}
async function runCase(config) {
  const env={...process.env,STAGING_URL:config.url,TEST_SPREADSHEET_ID:config.spreadsheetId},url=guard(env),report={origin:url.origin,suites:{}};
  let runToken,studentTokens;
  const call=async(body,token)=>{const at=performance.now();try {const r=await fetch(new URL('/api/staging-performance',url),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(80000)});return {data:await r.json(),ms:performance.now()-at,status:r.status,timeout:r.status===504};}catch(error){return {data:{success:false},ms:performance.now()-at,timeout:['TimeoutError','AbortError'].includes(error.name),transportFailure:true};}};
  const requireSuccess=rows=>{if(rows.some(r=>!r.data.success))throw Error('Failed or unknown result: no automatic resave.');};
  try {
    const start=await call({action:'startPerformanceRun'},env.STAGING_TEST_SECRET);requireSuccess([start]);
    if(start.data.fixture.spreadsheetId!==env.TEST_SPREADSHEET_ID)throw Error('Wrong spreadsheet.');
    runToken=start.data.runToken;studentTokens=start.data.studentTokens;report.initialFixture=start.data.fixture;
    if(Object.values(start.data.fixture.rowCounts).some(n=>n!==0))throw Error('Fresh synthetic spreadsheet required for the NEW row test. Nothing is deleted automatically.');
    report.before=(await call({action:'getPerformanceSnapshot'},runToken)).data;
    const logins=await Promise.all(Array.from({length:25},(_,i)=>call({action:'verifyStudent',grade:3,classNum:99,number:i+1,name:'Synthetic Student '+(i+1)},studentTokens[i])));
    report.suites.login=summarize(logins);requireSuccess(logins);
    logins.forEach((r,i)=>{if(r.data.student.googleId!=='synthetic'+(i+1)+'@example.invalid')throw Error('Own Google ID mismatch.');});
    const expected=Array.from({length:25},(_,i)=>'synthetic_'+Date.now()+'_'+(i+1));
    let sequence=0;
    const request=(action,i,extra={})=>({action,studentKey:'3-99-'+(i+1),studentToken:logins[i].data.studentToken,requestId:'synthetic_'+Date.now()+'_'+(++sequence),requestIssuedAt:Date.now(),roleModelName:expected[i],...extra});
    let repeated;
    for(const action of ['saveProgress','saveTests','submitFinal']) {
      for(const state of ['new','existing']) {
        const requests=Array.from({length:25},(_,i)=>request(action,i));
        const rows=await Promise.all(requests.map((p,i)=>call(p,studentTokens[i])));
        report.suites[state+'_'+action]=summarize(rows);requireSuccess(rows);
        if(action==='saveProgress'&&state==='existing')repeated=requests[0];
      }
    }
    const duplicates=await Promise.all(Array.from({length:10},()=>call(repeated,studentTokens[0])));
    report.suites.sameStudentDuplicate=summarize(duplicates);requireSuccess(duplicates);
    // Execute the actual local frontend transport against staging; discard ONE received write response.
    const {client}=require('./mock-client.cjs'),state={apiCalls:0};let drop=false,writeCalls=0;
    const api=client(url.origin,state,async(_u,o)=>{
      const body=JSON.parse(o.body),isWrite=body.action==='saveProgress';if(isWrite)writeCalls++;
      const row=await call(body,studentTokens[0]);
      if(isWrite&&drop){drop=false;throw new TypeError('Synthetic response loss');}
      return {ok:row.status===200,status:row.status||504,json:async()=>row.data};
    });
    await api.verifyStudentAuth({grade:3,classNum:99,number:1,name:'Synthetic Student 1'});
    expected[0]+='_lost';drop=true;
    const lossPayload={action:'saveProgress',studentKey:'3-99-1',roleModelName:expected[0]};
    await assert.rejects(()=>api.callGasApi(lossPayload));
    await assert.rejects(()=>api.callGasApi(lossPayload));assert.equal(writeCalls,1);
    const confirmation=await api.confirmPendingSave();assert.equal(confirmation.state,'completed');
    report.responseLoss={writeCalls,automaticResaves:writeCalls-1,confirmed:confirmation.state};
    const cancelled=request('saveProgress',0,{roleModelName:'must_never_apply'});
    const status=await call({action:'getSaveStatus',studentKey:'3-99-1',studentToken:cancelled.studentToken,requestId:cancelled.requestId,requestIssuedAt:cancelled.requestIssuedAt},studentTokens[0]);
    assert.equal(status.data.state,'cancelled');
    const late=await call(cancelled,studentTokens[0]);assert.equal(late.data.success,false);report.cancelledLateWrite={rejected:true};
    const loads=await Promise.all(logins.map((r,i)=>call({action:'loadProgress',studentKey:'3-99-'+(i+1),studentToken:r.data.studentToken},studentTokens[i])));
    requireSuccess(loads);report.wrongStudentUpdates=loads.filter((r,i)=>r.data.data?.roleModelName!==expected[i]).length;
    assert.equal(report.wrongStudentUpdates,0);
    report.after=(await call({action:'getPerformanceSnapshot'},runToken)).data;
    if(!report.after.success||report.after.foreignRows||Object.values(report.after.sheets).some(s=>s.duplicates || s.rows!==25))throw Error('Final row integrity failure.');
    report.completed=true;
  }catch(error){report.completed=false;report.error=error.message;}
  finally {
    if(runToken) {
      const end=await call({action:'finishPerformanceRun'},runToken);report.ended=Boolean(end.data.ended);
      if(report.ended)report.revocationVerified=!(await call({action:'getPerformanceSnapshot'},runToken)).data.success;
    }
  }
  return report;
}
async function main() {
  guard();
  const cases=JSON.parse(process.env.STAGING_CASES_JSON||'null');
  if(!Array.isArray(cases)||cases.length!==3||new Set(cases.map(c=>c.spreadsheetId)).size!==3)throw Error('STAGING_CASES_JSON must contain 3 separately prepared fresh synthetic spreadsheets/origins.');
  const reports=[];
  for(const config of cases) {reports.push(await runCase(config));fs.writeFileSync('staging-results.json',JSON.stringify({actualRuns:reports.length,reports},null,2));if(!reports.at(-1).completed)break;}
  if(reports.length!==3||reports.some(r=>!r.completed||!r.ended||!r.revocationVerified))process.exitCode=1;
}
module.exports={guard,summarize,runCase};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
