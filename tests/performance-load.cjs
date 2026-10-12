const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http'),assert=require('node:assert/strict'),ts=require('typescript');
const {backend}=require('./mock-runtime.cjs'),{targetFromEnvironment}=require('./performance-target.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const {client}=require('./mock-client.cjs');
function summary(samples){
  const sorted=samples.map(s=>s.ms).sort((a,b)=>a-b),q=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];
  const round=x=>Math.round(x*100)/100;
  return {operations:samples.length,success:samples.filter(s=>s.ok).length,failures:samples.filter(s=>!s.ok).length,
    averageMs:round(sorted.reduce((a,b)=>a+b,0)/sorted.length),p50Ms:round(q(.5)),p95Ms:round(q(.95)),maxMs:round(q(1)),
    timeouts:samples.filter(s=>s.timeout).length,apiCalls:samples.reduce((a,b)=>a+b.calls,0)};
}
async function main(){
  const requested=targetFromEnvironment(),b=backend(),state={injected:false,attempts:new Map(),status4xx:0,status5xx:0,requests:0};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
    if(req.url==='/__role_model_mock'){res.end(JSON.stringify({mock:true,fixture:'synthetic-only'}));return;}
    if(req.url!=='/api/gas-proxy'||req.method!=='POST'){res.statusCode=404;state.status4xx++;res.end('{}');return;}
    let body='';for await(const chunk of req)body+=chunk;
    const p=JSON.parse(body);state.requests++;
    const key=p.action+':'+p.studentKey,attempt=state.attempts.get(key)||0;state.attempts.set(key,attempt+1);
    if(state.injected&&p.action==='saveProgress'&&Number(p.studentKey?.split('-')[2])%5===0&&attempt===0){
      res.statusCode=503;state.status5xx++;res.end(JSON.stringify({success:false}));return;
    }
    await sleep(state.injected?120:5);
    res.end(JSON.stringify(b.request(p)));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(requested.port),requested.hostname==='[::1]'?'::1':requested.hostname,resolve);});
  const target=new URL(requested);target.port=String(server.address().port);
  try {
    const marker=await(await fetch(new URL('/__role_model_mock',target))).json();assert.equal(marker.fixture,'synthetic-only');
    const counters=Array.from({length:25},()=>({apiCalls:0})),apis=counters.map(c=>client(target,c)),progress=[];
    const phases={};
    async function phase(name,run){
      const samples=await Promise.all(apis.map(async(api,i)=>{
        const calls=counters[i].apiCalls,start=performance.now();let ok=true,timeout=false;
        try {await run(api,i);}catch(e){ok=false;timeout=['TimeoutError','AbortError'].includes(e.name);}
        return {ms:performance.now()-start,ok,timeout,calls:counters[i].apiCalls-calls};
      }));phases[name]=summary(samples);assert.equal(phases[name].failures,0,name);
    }
    await phase('options-cold',async api=>assert.deepEqual(Array.from((await api.getRosterOptions()).grades),[3]));
    await phase('options-warm',async api=>await api.getRosterOptions());
    await phase('login',async(api,i)=>{
      const result=await api.verifyStudentAuth({grade:3,classNum:1,number:i+1,name:'가상학생'+(i+1)});
      assert.equal(result.success,true);assert.equal(result.student.googleId,'mock'+(i+1)+'@example.invalid');progress[i]=result.progress;
    });
    await phase('save-25',async(api,i)=>{
      progress[i].step1.roleModelName='가상모델'+(i+1);
      assert.equal((await api.saveStep1Progress(progress[i],progress[i].step1)).success,true);
    });
    await phase('rapid-identical-save',async(api,i)=>{
      const results=await Promise.all(Array.from({length:10},()=>api.saveStep1Progress(progress[i],progress[i].step1)));
      assert.ok(results.every(r=>r.success));
    });
    await phase('submit-25',async(api,i)=>assert.equal((await api.submitFinal(progress[i],progress[i].step10,progress[i])).success,true));
    await phase('submit-repeat',async(api,i)=>assert.equal((await api.submitFinal(progress[i],progress[i].step10,progress[i])).success,true));
    state.injected=true;state.attempts.clear();
    await phase('delayed-503-retry',async(api,i)=>assert.equal((await api.saveStep1Progress(progress[i],progress[i].step1)).success,true));
    const invariants={duplicateRows:0,wrongStudentUpdates:0};
    for(const name of ['Progress','Submissions']){
      const sheet=b.sheets.get(name),keys=sheet.rows.slice(1).map(row=>row[0]);invariants.duplicateRows+=keys.length-new Set(keys).size;
      assert.equal(keys.length,25);
      if(name==='Progress')for(const row of sheet.rows.slice(1)){
        const n=Number(row[0].split('-')[2]);if(row[6]!=='가상모델'+n)invariants.wrongStudentUpdates++;
      }
    }
    assert.equal(invariants.duplicateRows,0);assert.equal(invariants.wrongStudentUpdates,0);
    assert.equal(phases['rapid-identical-save'].apiCalls,25);assert.equal(phases['options-warm'].apiCalls,0);
    assert.equal(phases['delayed-503-retry'].apiCalls,30);
    const result={environment:'loopback HTTP + actual client + GAS in-memory emulator; NOT Vercel/GAS timing',concurrency:25,phases,
      transport:{requests:state.requests,http4xx:state.status4xx,http5xx:state.status5xx},invariants,sheetWork:b.stats()};
    if(process.env.PERF_RESULT_FILE)fs.writeFileSync(process.env.PERF_RESULT_FILE,JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
