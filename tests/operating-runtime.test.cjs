const {test}=require('node:test'),assert=require('node:assert/strict');
const env=()=>({OPERATING_POSTGRES:'enabled',VERCEL_ENV:'production',OPERATING_SCHEMA:'role_model_operating',OPERATING_SESSION_SECRET:'s'.repeat(40),OPERATING_DATABASE_URL:'postgresql://postgres.rxzholiocjaczueobhsr:synthetic-not-a-password@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres',LOGIN_BATCH_READS:'disabled'});
test('operating gate rejects preview, synthetic project, staging flags, wrong schema, missing secrets and batch reads',async()=>{
 const {operatingConfiguration}=await import('../transactional/operating-runtime.mjs');
 assert.equal(operatingConfiguration(env()).schema,'role_model_operating');
 for(const patch of [{VERCEL_ENV:'preview'},{OPERATING_POSTGRES:'wrong'},{OPERATING_SCHEMA:'public'},{OPERATING_SESSION_SECRET:''},{TRANSACTIONAL_SYNTHETIC:'synthetic-only-25'},{STAGING_PERF_MODE:'synthetic-25'},{TEST_GAS_URL:'https://example.invalid'},{LOGIN_BATCH_READS:'true'},{OPERATING_DATABASE_URL:env().OPERATING_DATABASE_URL.replace('rxzholiocjaczueobhsr','vanvpimargvummzqunto')}]) assert.throws(()=>operatingConfiguration({...env(),...patch}));
});
test('operating dispatch preserves version receipt protocol, separates administrators and never falls back to GAS',async()=>{
 const {makeOperatingDispatch}=await import('../transactional/operating-runtime.mjs');let calls=0,seen;
 const dispatch=makeOperatingDispatch({env:env(),connect:async options=>{assert.equal(options.mode,'registered');calls++;return {};},create:async()=>({maintenanceStatus:async()=>({epoch:3,openedAt:200}),dispatch:async(p,o)=>{seen={p,o};return {success:true,version:8,state:'completed',savedAt:'2026-10-15T00:00:00Z'};}})});
 const out=await dispatch({action:'saveProgress',expectedVersion:7,requestId:'synthetic_request'});
 assert.equal(out.storageBackend,'transactional-postgres');assert.equal(out.version,8);assert.equal(seen.p.expectedVersion,7);assert.equal(seen.p.requestId,'synthetic_request');
 await assert.rejects(dispatch({action:'getAdminDashboard'}),e=>e.code==='SCOPE');
 await assert.rejects(dispatch({action:'saveProgress',adminSecret:'forged'}),e=>e.code==='SCOPE');
 await assert.rejects(dispatch({action:'updateRoster'},{admin:true,adminIssuedAt:100}),e=>e.code==='STALE_EPOCH');
 await dispatch({action:'getAdminDashboard'},{admin:true});assert.equal(calls,1);assert.equal(seen.o.admin,true);
 const bad=makeOperatingDispatch({env:env(),connect:async()=>{throw Error('private connection error');}});
 await assert.rejects(bad({action:'verifyStudent'}),e=>e.code==='CONFIG'&&!e.message.includes('private connection'));
});
test('offline source plan preserves raw rows, typed data, test exclusions and rejects ambiguous dates',async()=>{
 const {planSourceArchive}=await import('../tools/offline-backup/source-plan.mjs'),{makeLegacySyntheticFixture}=await import('../transactional/migration.mjs');
 const legacy=makeLegacySyntheticFixture();legacy.sheets.Roster.push(['3-1-26',3,1,26,'교사합성테스트','']);
 const first=Object.fromEntries(Object.entries(legacy.sheets).map(([sheet,grid])=>[sheet,{projection:{grid,richCells:grid.map(row=>row.map(()=>({metadata:{}}))),compact:null}}]));
 const source={format:'role-model-native-sheet-source-v1',verification:{sourceDoubleReadMatched:true,fullSelectionConfirmedByOperator:true,noTestRowsExcluded:true},first,second:structuredClone(first)};
 const plan=planSourceArchive(source);assert.equal(plan.summary.students,25);assert.equal(plan.legacyArchive.sheets.Roster.length,27);assert.equal(plan.summary.excludedRowsPreserved.Roster,1);
 const at=source.first.Submissions.projection.grid[0].indexOf('submittedAt');
 for(const side of ['first','second'])source[side].Submissions.projection.richCells[1][at].metadata['data-sheets-value']=JSON.stringify({'1':3,'3':46261.5});
 assert.throws(()=>planSourceArchive(source),/DATE_TYPE_REQUIRES_REVIEW/);
});
test('registered roster accepts the actual school roster size without weakening synthetic scope',async()=>{
 const {changeRoster,registeredIdentity,syntheticIdentity}=await import('../transactional/roster.mjs');
 const students=Array.from({length:126},(_,i)=>({grade:3,classNum:Math.floor(i/30)+1,number:i%30+1,name:'합성 명단 '+i,googleId:'synthetic'+i+'@example.invalid'}));
 let inserts=0;const db={kind:'postgres',transaction:async(k,fn)=>fn(async(sql)=>{if(sql.startsWith('INSERT INTO synthetic_students'))inserts++;return [];})};
 await changeRoster(db,{action:'updateRoster',mode:'append',students},registeredIdentity);assert.equal(inserts,126);
 await assert.rejects(changeRoster(db,{action:'updateRoster',mode:'append',students},syntheticIdentity));
});
