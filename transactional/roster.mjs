// Synthetic deployment boundary remains explicit. Never admit real student records.
const fail=()=>{throw Object.assign(new Error('명단 신원이 충돌하거나 합성 시험 범위를 벗어났습니다.'),{code:'SCOPE'});};
export function registeredIdentity(value,{deletion=false}={}) {
  const grade=Number(value.grade),classNum=Number(value.classNum??value.class),number=Number(value.number),name=String(value.name||'').normalize('NFC').trim(),googleId=String(value.googleId||'').trim();
  if(!Number.isInteger(grade)||grade<1||grade>6||!Number.isInteger(classNum)||classNum<1||classNum>30||!Number.isInteger(number)||number<1||number>99||!name||name.length>100||googleId.length>320)fail();
  const studentKey=`${grade}-${classNum}-${number}`;if(value.studentKey&&value.studentKey!==studentKey)fail();
  return {studentKey,grade,classNum,number,name,...(!deletion?{googleId}:{})};
}
export function syntheticIdentity(value,{deletion=false}={}) {
  const grade=Number(value.grade),classNum=Number(value.classNum??value.class),number=Number(value.number);
  const name=String(value.name||'').normalize('NFC').trim();
  if(grade!==3||classNum!==1||!Number.isInteger(number)||number<1||number>100||name!==`합성학생${number}`)fail();
  const studentKey=`${grade}-${classNum}-${number}`,googleId=`synthetic${number}@example.invalid`;
  if(value.studentKey&&value.studentKey!==studentKey||!deletion&&value.googleId!==googleId)fail();
  return {studentKey,grade,classNum,number,name,googleId};
}
export const isActive=row=>JSON.parse(row.document).rosterActive!==false;
export async function rosterRows(db){return (await db.query('SELECT * FROM synthetic_students ORDER BY student_key')).filter(isActive).sort((a,b)=>JSON.parse(a.identity).grade-JSON.parse(b.identity).grade||JSON.parse(a.identity).classNum-JSON.parse(b.identity).classNum||JSON.parse(a.identity).number-JSON.parse(b.identity).number);}
export async function changeRoster(db,p,validateIdentity=syntheticIdentity){
  const deleting=p.action==='deleteRosterStudents';
  if(!Array.isArray(p.students)||(!p.students.length&&(deleting||p.mode!=='replace'))||p.students.length>100||!deleting&&!['append','replace'].includes(p.mode))fail();
  const incoming=p.students.map(s=>validateIdentity(s,{deletion:deleting}));
  if(new Set(incoming.map(s=>s.studentKey)).size!==incoming.length)fail();
  return db.transaction('__roster__',async q=>{
    // Serializes roster writers (including absent-row creation) without serializing normal saves.
    await q('SELECT id FROM synthetic_meta WHERE id=1'+(db.kind==='postgres'?' FOR UPDATE':''));
    const rows=await q('SELECT * FROM synthetic_students ORDER BY student_key'+(db.kind==='postgres'?' FOR UPDATE':''));
    const byKey=new Map(rows.map(r=>[r.student_key,r]));
    for(const s of incoming){const old=byKey.get(s.studentKey);if(deleting&&!old)fail();if(old){const identity=JSON.parse(old.identity);if(Object.keys(s).some(k=>s[k]!==identity[k]))fail();}}
    const keys=new Set(incoming.map(s=>s.studentKey));let deletedCount=0;
    for(const old of rows){
      const deactivate=deleting?keys.has(old.student_key):p.mode==='replace'&&!keys.has(old.student_key);
      if(deactivate&&isActive(old)){
        const document={...JSON.parse(old.document),rosterActive:false};
        await q('UPDATE synthetic_students SET document=?,version=version+1 WHERE student_key=?',[JSON.stringify(document),old.student_key]);
        await q('DELETE FROM synthetic_sessions WHERE student_key=?',[old.student_key]);deletedCount++;
      }
    }
    if(!deleting)for(const s of incoming){const old=byKey.get(s.studentKey);if(!old){await q('INSERT INTO synthetic_students(student_key,identity,document) VALUES(?,?,?)',[s.studentKey,JSON.stringify(s),JSON.stringify({...s,currentStep:1})]);}else if(!isActive(old)){await q('UPDATE synthetic_students SET document=?,version=version+1 WHERE student_key=?',[JSON.stringify({...JSON.parse(old.document),rosterActive:true}),s.studentKey]);}}
    const count=(await q('SELECT document FROM synthetic_students')).filter(isActive).length;
    return {success:true,count,deletedCount,message:'명단이 반영되었습니다. 제외된 학생의 작성 자료는 보존됩니다.'};
  },{write:true,issuedAt:p.requestIssuedAt,epoch:p.storageEpoch});
}
