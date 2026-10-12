import {fixture,verifyInitialized} from './store.mjs';
// Only synthetic databases. No Google Sheets connector or production migration exists here.
export async function exportSyntheticSnapshot(db) {
  await verifyInitialized(db);
  const students=[],receipts=[];
  // Each student's document + receipts are coherent; cutover backup still requires a write pause.
  for(const s of fixture)await db.transaction(s.studentKey,async q=>{
    students.push(...await q('SELECT * FROM synthetic_students WHERE student_key=?',[s.studentKey]));
    receipts.push(...await q('SELECT * FROM synthetic_receipts WHERE student_key=?',[s.studentKey]));return {};
  });
  return {format:'synthetic-only-backup-v1',exportedAt:new Date().toISOString(),students,receipts};
}
export async function restoreSyntheticSnapshot(db,snapshot) {
  await verifyInitialized(db);
  if(snapshot.format!=='synthetic-only-backup-v1'||snapshot.students?.length!==25||new Set(snapshot.students.map(s=>s.student_key)).size!==25)throw Error('Invalid synthetic snapshot');
  for(const row of snapshot.students){const identity=JSON.parse(row.identity),expected=fixture.find(s=>s.studentKey===row.student_key),document=JSON.parse(row.document);if(!expected||JSON.stringify(identity)!==JSON.stringify(expected)||document.studentKey!==expected.studentKey||document.googleId!==expected.googleId||!Number.isSafeInteger(row.version))throw Error('Synthetic snapshot scope mismatch');}
  if(snapshot.receipts.some(r=>!fixture.some(s=>s.studentKey===r.student_key)))throw Error('Foreign receipt');
  const used=await db.query('SELECT student_key FROM synthetic_students WHERE version<>0');const count=await db.query('SELECT COUNT(*) n FROM synthetic_receipts');
  if(used.length||Number(count[0].n))throw Error('Restore requires unused destination; never overwrite newer answers');
  for(const row of snapshot.students)await db.transaction(row.student_key,async q=>{
    // Recheck under row lock so a concurrent first save cannot be overwritten.
    if((await q('SELECT version FROM synthetic_students WHERE student_key=?',[row.student_key]))[0].version!==0)throw Error('Destination changed');
    await q('UPDATE synthetic_students SET document=?,version=? WHERE student_key=?',[row.document,row.version,row.student_key]);
    for(const r of snapshot.receipts.filter(r=>r.student_key===row.student_key))await q('INSERT INTO synthetic_receipts(student_key,request_id,fingerprint,state,result,expires_at) VALUES(?,?,?,?,?,?)',[r.student_key,r.request_id,r.fingerprint,r.state,r.result,r.expires_at]);return {};
  });
}
