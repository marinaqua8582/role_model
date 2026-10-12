import {fixture,verifyInitialized} from './store.mjs';
// Only synthetic databases. No Google Sheets connector or production migration exists here.
export async function exportSyntheticSnapshot(db) {
  await verifyInitialized(db);
  // Maintenance only: lock all student rows in stable order for a coherent backup.
  const result=await db.transaction(fixture[0].studentKey,async q=>{
    const students=await q('SELECT * FROM synthetic_students ORDER BY student_key'+(db.kind==='postgres'?' FOR UPDATE':''));
    const receipts=await q('SELECT * FROM synthetic_receipts ORDER BY student_key,request_id');
    return {format:'synthetic-only-backup-v1',exportedAt:new Date().toISOString(),students,receipts};
  });
  const {metrics,...snapshot}=result;return snapshot;
}
export async function restoreSyntheticSnapshot(db,snapshot) {
  await verifyInitialized(db);
  if(snapshot.format!=='synthetic-only-backup-v1'||snapshot.students?.length!==25||new Set(snapshot.students.map(s=>s.student_key)).size!==25)throw Error('Invalid synthetic snapshot');
  for(const row of snapshot.students){const identity=JSON.parse(row.identity),expected=fixture.find(s=>s.studentKey===row.student_key),document=JSON.parse(row.document);if(!expected||JSON.stringify(identity)!==JSON.stringify(expected)||document.studentKey!==expected.studentKey||document.googleId!==expected.googleId||!Number.isSafeInteger(row.version))throw Error('Synthetic snapshot scope mismatch');}
  if(snapshot.receipts.some(r=>!fixture.some(s=>s.studentKey===r.student_key)))throw Error('Foreign receipt');
  const used=await db.query('SELECT student_key FROM synthetic_students WHERE version<>0');const count=await db.query('SELECT COUNT(*) n FROM synthetic_receipts');
  if(used.length||Number(count[0].n))throw Error('Restore requires unused destination; never overwrite newer answers');
  await db.transaction(fixture[0].studentKey,async q=>{
    const all=await q('SELECT student_key,version FROM synthetic_students ORDER BY student_key'+(db.kind==='postgres'?' FOR UPDATE':''));
    if(all.some(r=>r.version!==0)||Number((await q('SELECT COUNT(*) n FROM synthetic_receipts'))[0].n))throw Error('Destination changed');
    for(const row of snapshot.students){
      await q('UPDATE synthetic_students SET document=?,version=? WHERE student_key=?',[row.document,row.version,row.student_key]);
      for(const r of snapshot.receipts.filter(r=>r.student_key===row.student_key))await q('INSERT INTO synthetic_receipts(student_key,request_id,fingerprint,state,result,expires_at) VALUES(?,?,?,?,?,?)',[r.student_key,r.request_id,r.fingerprint,r.state,r.result,r.expires_at]);
    }return {};
  });
}
