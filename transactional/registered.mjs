// Prepared operating policy, exercised only with invented identities. Not connected to production HTTP/env.
import {createHash} from 'node:crypto';
import {registeredIdentity} from './roster.mjs';
import {verifyInitialized} from './store.mjs';
import {planRegisteredMigration} from './migration.mjs';

const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
async function frozen(q,db){
  if(db.kind==='postgres')await q('SELECT pg_advisory_xact_lock(174014,1)');
  const [s]=await q('SELECT closed FROM synthetic_control WHERE id=1');
  if(!s?.closed)throw Error('Maintenance freeze required');
  await q('SELECT id FROM synthetic_meta WHERE id=1'+(db.kind==='postgres'?' FOR UPDATE':''));
}
export async function exportRegisteredSnapshot(db) {
  await verifyInitialized(db,{registered:true,identities:[]});
  const r=await db.transaction('__snapshot__',async q=>{
    await frozen(q,db);
    const students=await q('SELECT * FROM synthetic_students ORDER BY student_key'+(db.kind==='postgres'?' FOR UPDATE':''));
    const receipts=await q('SELECT * FROM synthetic_receipts ORDER BY student_key,request_id');
    return {format:'registered-backup-v1',students,receipts};
  });
  const {metrics,...snapshot}=r;return snapshot;
}
export function validateRegisteredSnapshot(snapshot) {
  if(snapshot?.format!=='registered-backup-v1'||!Array.isArray(snapshot.students)||!snapshot.students.length||!Array.isArray(snapshot.receipts))throw Error('Invalid registered snapshot');
  const keys=new Set();
  for(const row of snapshot.students){
    const s=registeredIdentity(JSON.parse(row.identity)),d=JSON.parse(row.document);
    if(keys.has(s.studentKey)||s.studentKey!==row.student_key||!Number.isSafeInteger(row.version)||row.version<0||Object.entries(s).some(([k,v])=>d[k]!==v))throw Error('Snapshot identity/version conflict');
    keys.add(s.studentKey);
  }
  const ids=new Set();
  for(const r of snapshot.receipts){const id=JSON.stringify([r.student_key,r.request_id]);if(!keys.has(r.student_key)||ids.has(id)||!r.request_id||!r.state||!Number.isFinite(Number(r.expires_at)))throw Error('Invalid receipt snapshot');ids.add(id);}
}
export async function restoreRegisteredSnapshot(db,snapshot) {
  await verifyInitialized(db,{registered:true,identities:[]});validateRegisteredSnapshot(snapshot);
  return db.transaction('__restore__',async q=>{
    await frozen(q,db);
    const existing=await q('SELECT * FROM synthetic_students ORDER BY student_key'+(db.kind==='postgres'?' FOR UPDATE':''));
    if(existing.some(r=>r.version!==0)||Number((await q('SELECT COUNT(*) n FROM synthetic_receipts'))[0].n))throw Error('Destination used; never overwrite newer answers');
    for(const old of existing){const incoming=snapshot.students.find(s=>s.student_key===old.student_key);if(!incoming||old.identity!==incoming.identity)throw Error('Destination roster conflict');}
    for(const r of snapshot.students)await q('INSERT INTO synthetic_students(student_key,identity,document,version) VALUES(?,?,?,?) ON CONFLICT(student_key) DO UPDATE SET document=excluded.document,version=excluded.version',[r.student_key,r.identity,r.document,r.version]);
    for(const r of snapshot.receipts)await q('INSERT INTO synthetic_receipts(student_key,request_id,fingerprint,state,result,expires_at) VALUES(?,?,?,?,?,?)',[r.student_key,r.request_id,r.fingerprint??null,r.state,r.result??null,r.expires_at]);
    return {success:true,students:snapshot.students.length,receipts:snapshot.receipts.length};
  });
}
export async function applyRegisteredMigration(db,plan) {
  const verified=planRegisteredMigration(plan.legacyArchive,{excludeStudentKeys:plan.excludeStudentKeys||[]});
  if(hash(plan)!==hash(verified))throw Error('Migration plan changed');
  await verifyInitialized(db,{registered:true,identities:[]});
  const requestId='migration_'+plan.sourceDigest;
  return db.transaction('__migration__',async q=>{
    await frozen(q,db);
    const rows=await q('SELECT * FROM synthetic_students ORDER BY student_key'+(db.kind==='postgres'?' FOR UPDATE':''));
    const receipts=await q('SELECT * FROM synthetic_receipts');
    const already=receipts.filter(r=>r.request_id===requestId&&r.fingerprint===plan.sourceDigest);
    if(already.length===plan.snapshot.students.length&&new Set(already.map(r=>r.student_key)).size===plan.snapshot.students.length)return {success:true,alreadyApplied:true};
    if(receipts.length||rows.some(r=>r.version!==0)||rows.length!==plan.snapshot.students.length||rows.some(r=>!plan.snapshot.students.some(s=>s.student_key===r.student_key&&s.identity===r.identity)))throw Error('Destination used or identity conflict');
    for(const r of plan.snapshot.students){await q('UPDATE synthetic_students SET document=?,version=? WHERE student_key=?',[r.document,r.version,r.student_key]);await q('INSERT INTO synthetic_receipts(student_key,request_id,fingerprint,state,result,expires_at) VALUES(?,?,?,?,?,?)',[r.student_key,requestId,plan.sourceDigest,'completed',JSON.stringify({success:true,version:r.version}),Date.now()+86400000]);}
    return {success:true,alreadyApplied:false};
  });
}
export function reconcileRegistered(plan,snapshot) {
  validateRegisteredSnapshot(snapshot);
  if(hash([...plan.snapshot.students].sort((a,b)=>a.student_key.localeCompare(b.student_key)))!==hash([...snapshot.students].sort((a,b)=>a.student_key.localeCompare(b.student_key))))throw Error('Migrated documents/versions differ');
  return {matched:true,students:snapshot.students.length,sourceRows:plan.summary.sourceRows};
}
