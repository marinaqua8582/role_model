// Deliberately no production mode. Only the previously approved synthetic Supabase project.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {openDatabase,initialize,fixture,createRegisteredService} from './store.mjs';
import {setMaintenance,stableSnapshot} from './maintenance.mjs';
import {planRegisteredMigration,makeLegacySyntheticFixture,encryptPrivateBackup,decryptPrivateBackup} from './migration.mjs';
import {applyRegisteredMigration,exportRegisteredSnapshot,restoreRegisteredSnapshot,reconcileRegistered} from './registered.mjs';
if(process.env.CUTOVER_REHEARSAL_CONFIRM!=='SYNTHETIC_ONLY')throw Error('Explicit synthetic rehearsal confirmation required');
const config=JSON.parse(readFileSync(process.env.CUTOVER_PRIVATE_FILE,'utf8'));
const parsed=new URL(config.databaseUrl);
if(decodeURIComponent(parsed.username)!=='postgres.vanvpimargvummzqunto'||!parsed.hostname.endsWith('.pooler.supabase.com'))throw Error('Not the approved synthetic project');
if(config.databasePassword)parsed.password=encodeURIComponent(config.databasePassword);
const suffix=randomBytes(5).toString('hex'),report={environment:'actual synthetic Supabase PostgreSQL, isolated rehearsal schemas',students:25,productionAccessed:false,completed:false};
const source=await openDatabase({url:parsed.href,schema:'role_model_synthetic_rehearsal_cutover_'+suffix}),target=await openDatabase({url:parsed.href,schema:'role_model_synthetic_rehearsal_recover_'+suffix});
try {
  await initialize(source,{registered:true,identities:fixture});await initialize(target,{registered:true,identities:fixture});
  const app=await createRegisteredService(source,randomBytes(32).toString('hex'));
  const archived=makeLegacySyntheticFixture();archived.format='legacy-sheets-registered-v1';
  archived.sheets.Counseling=[['studentKey','barrierAnswer','completedAt'],[fixture[0].studentKey,'합성 상담 보존','2026-10-02T00:00:00Z']];
  const plan=planRegisteredMigration(archived);
  // In-flight writer holds shared admission; exclusive close must wait for its commit.
  let admitted;const started=new Promise(resolve=>admitted=resolve);let release;const held=new Promise(resolve=>release=resolve);
  const writer=source.transaction(fixture[0].studentKey,async()=>{admitted();await held;return {success:true};},{write:true});
  await started;let freezeReturned=false;const freeze=setMaintenance(source,true).then(r=>{freezeReturned=true;return r;});
  await new Promise(r=>setTimeout(r,200));assert.equal(freezeReturned,false);release();await writer;await freeze;report.admittedWriterDrain=true;
  const before={...(await stableSnapshot(source,exportRegisteredSnapshot)),legacyArchive:archived},key=randomBytes(32);assert.deepEqual(decryptPrivateBackup(encryptPrivateBackup(before,key),key),before);report.encryptedBackup=true;
  await applyRegisteredMigration(source,plan);assert.equal((await applyRegisteredMigration(source,plan)).alreadyApplied,true);report.migrationIdempotent=true;
  assert.ok(reconcileRegistered(plan,await exportRegisteredSnapshot(source)).matched);report.sourceComparison=true;
  const frozenLogin=await app.dispatch({action:'verifyStudent',...fixture[0]});
  const intent={action:'saveProgress',studentToken:frozenLogin.studentToken,expectedVersion:frozenLogin.version,requestId:randomUUID(),requestIssuedAt:Date.now(),roleModelReason:'지연 요청'};
  await assert.rejects(app.dispatch(intent),e=>e.code==='MAINTENANCE');await setMaintenance(source,false);
  await assert.rejects(app.dispatch({...intent,requestIssuedAt:Date.now()}),e=>e.code==='STALE_EPOCH');report.delayedWritesBlocked=true;
  const login=await app.dispatch({action:'verifyStudent',...fixture[0]});assert.equal(login.student.googleId,fixture[0].googleId);assert.ok(!JSON.stringify(login).includes(fixture[1].googleId));
  const save={action:'submitFinal',studentToken:login.studentToken,expectedVersion:login.version,requestId:randomUUID(),requestIssuedAt:Date.now(),finalCareerReflection:'합성 전환 후 새 답안'};
  await app.dispatch(save);assert.equal((await app.dispatch(save)).replayed,true);report.newFinalAndReplay=true;
  const relogin=await app.dispatch({action:'verifyStudent',...fixture[0]}),admin=await app.dispatch({action:'getAdminDashboard'},{admin:true});assert.deepEqual(admin.data.students.find(s=>s.studentKey===fixture[0].studentKey),relogin.progress);report.studentAdminMatch=true;
  for(const state of ['pending','unknown','cancelled'])await source.query('INSERT INTO synthetic_receipts(student_key,request_id,state,expires_at) VALUES(?,?,?,?)',[fixture[0].studentKey,randomUUID(),state,Date.now()+86400000]);
  await setMaintenance(source,true);const latest=await exportRegisteredSnapshot(source);await setMaintenance(target,true);await restoreRegisteredSnapshot(target,latest);assert.deepEqual(await exportRegisteredSnapshot(target),latest);await assert.rejects(restoreRegisteredSnapshot(target,latest),/never overwrite/);report.latestAnswersVersionsReceiptsRestored=true;report.pendingUnknownCancelledReceiptsPreserved=true;
  report.completed=true;report.schemas=[source.schema,target.schema];
} finally {await source.close();await target.close();}
writeFileSync(process.env.CUTOVER_REPORT_FILE||'verification/cutover-pg-rehearsal.json',JSON.stringify(report,null,2)+'\n');
console.info(JSON.stringify({completed:report.completed,students:25,productionAccessed:false}));
