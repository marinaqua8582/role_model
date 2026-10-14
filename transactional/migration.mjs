import {registeredIdentity} from './roster.mjs';
import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {fixture,verifyInitialized} from './store.mjs';

const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const norm=x=>String(x??'').normalize('NFC').trim().replace(/\s+/g,'');
export function normalizeLegacyKey(value) {
  const parts=String(value??'').normalize('NFKC').replace(/\s+/g,'').split('-');
  if(parts.length!==3||parts.some(x=>!/^\d+$/.test(x)||Number(x)<1||!Number.isSafeInteger(Number(x))))throw Error('Invalid legacy key');
  return parts.map(Number).join('-');
}
const aliases={학년:'grade',반:'classNum',class:'classNum',classNo:'classNum',번호:'number',이름:'name',google_id:'googleId',구글아이디:'googleId',student_key:'studentKey'};
function tableRows(table) {
  if(!Array.isArray(table)||!Array.isArray(table[0]))throw Error('Missing sheet header');
  const header=table[0].map(v=>aliases[String(v).trim()]||String(v).trim());
  if(header.some(h=>!h)||new Set(header).size!==header.length)throw Error('Ambiguous sheet header');
  return table.slice(1).filter(r=>r.some(v=>v!==''&&v!==null)).map(r=>{
    if(!Array.isArray(r)||r.length>header.length)throw Error('Invalid sheet row');
    return Object.fromEntries(header.map((h,i)=>[h,r[i]??'']));
  });
}
function owner(row, rosterOnly=false, identities=fixture) {
  const derived=[row.grade,row.classNum,row.number].every(v=>v!==undefined&&v!=='')?normalizeLegacyKey([row.grade,row.classNum,row.number].join('-')):null;
  const key=row.studentKey?normalizeLegacyKey(row.studentKey):derived;
  if(!key||derived&&key!==derived)throw Error('Identity/key conflict');
  const student=identities.find(s=>s.studentKey===key);
  if(!student||rosterOnly&&!row.name||row.name&&norm(row.name)!==norm(student.name)||row.googleId&&String(row.googleId).trim()!==student.googleId||row.ownerName&&norm(row.ownerName)!==norm(student.name)||row.ownerGoogleId&&String(row.ownerGoogleId).trim()!==student.googleId)throw Error('Non-synthetic or ambiguous legacy identity');
  return student;
}
function parseFields(row) {
  const out={...row};
  for(const k of ['stepData',...Array.from({length:11},(_,i)=>'step'+(i+1))])if(typeof out[k]==='string'&&out[k]){try{out[k]=JSON.parse(out[k]);}catch{throw Error('Invalid legacy JSON');}if(!out[k]||typeof out[k]!=='object'||Array.isArray(out[k]))throw Error('Invalid legacy object');}
  for(const k of ['isFinalSubmitted','isTestCompleted','isPromptCompleted','isGemSubmitted','isCounselingCompleted'])if(k in out){if([true,'true','TRUE',1,'1'].includes(out[k]))out[k]=true;else if([false,'false','FALSE',0,'0',''].includes(out[k]))out[k]=false;else throw Error('Invalid legacy completion state');}
  return out;
}
export function planSyntheticMigration(input) { return planMigration(input,fixture); }
export function planRegisteredMigration(input) {
  if(input?.format!=='legacy-sheets-registered-v1')throw Error('Registered archive required');
  const identities=tableRows(input.sheets?.Roster).map(r=>registeredIdentity({...r,studentKey:r.studentKey?normalizeLegacyKey(r.studentKey):undefined}));
  if(!identities.length||identities.length>10000||new Set(identities.map(s=>s.studentKey)).size!==identities.length)throw Error('Ambiguous registered roster');
  return planMigration(input,identities,true);
}
function planMigration(input,identities,registered=false) {
  if(input?.format!==(registered?'legacy-sheets-registered-v1':'legacy-sheets-synthetic-v1')||!input.sheets)throw Error('Synthetic legacy format required');
  const rows=Object.fromEntries(['Roster','Progress','Tests','Submissions','Counseling'].map(name=>[name,name==='Counseling'&&!input.sheets[name]?[]:tableRows(input.sheets[name])]));
  if(rows.Roster.length!==identities.length)throw Error('Exactly 25 synthetic roster rows required');
  const roster=rows.Roster.map(r=>owner(r,true,identities));if(new Set(roster.map(s=>s.studentKey)).size!==identities.length)throw Error('Duplicate roster identity');
  let duplicates=0;const grouped={};
  for(const name of ['Progress','Tests','Submissions','Counseling']){
    grouped[name]=new Map();for(const row of rows[name]){const s=owner(row,false,identities),parsed=parseFields(row),old=grouped[name].get(s.studentKey);if(old){duplicates++;if(hash(old)!==hash(parsed))throw Error('Conflicting duplicate rows require manual resolution; source preserved');}else grouped[name].set(s.studentKey,parsed);}
  }
  const students=identities.map(s=>{
    const progress=grouped.Progress.get(s.studentKey)||{},tests=grouped.Tests.get(s.studentKey)||{},submission=grouped.Submissions.get(s.studentKey)||{},counseling=grouped.Counseling.get(s.studentKey)||{};
    const final={...submission,...submission.step10},counselingValues={...counseling,...counseling.step11};
    for(const k of ['barrierAnswer','barrierReflection','decisionAnswer','decisionReflection','educationAnswer','educationReflection','finalCareerReflection','gemUrl']){
      const value=counselingValues[k];if(value===undefined||value==='')continue;
      if(final[k]!==undefined&&final[k]!==''&&final[k]!==value){
        const a=Date.parse(submission.submittedAt),b=Date.parse(counselingValues.completedAt);
        if(!Number.isFinite(a)||!Number.isFinite(b)||a===b)throw Error('Conflicting counseling/submission requires explicit resolution');
        if(b<a)continue;
      } final[k]=value;
    }
    const merged={...progress};for(const source of [tests,final])for(const [k,v] of Object.entries(source))if(v!==''&&v!==undefined&&v!==null)merged[k]=v;
    const document={...merged,...s,stepData:progress.stepData||{},step8:{...progress.step8,...(tests.step8||tests),tests:{...progress.step8?.tests,...tests.step8?.tests}},step10:{...progress.step10,...final},step11:{...progress.step11,...counselingValues},isCounselingCompleted:Boolean(progress.isCounselingCompleted||counselingValues.completedAt),currentStep:Number(progress.currentStep)||1};
    document.isFinalSubmitted=Boolean(progress.isFinalSubmitted||submission.submittedAt||counselingValues.completedAt);
    if(Object.keys(counseling).length)document.stepData={...document.stepData,step10:{...document.stepData.step10,...document.step10},step11:{...document.stepData.step11,...document.step11}};if(document.isFinalSubmitted)document.currentStep=10;
    return {student_key:s.studentKey,identity:JSON.stringify(s),version:1,document:JSON.stringify(document)};
  });
  const sourceDigest=hash(input);
  return {format:registered?'registered-migration-plan-v1':'synthetic-migration-plan-v1',sourceDigest,legacyArchive:structuredClone(input),snapshot:{format:registered?'registered-backup-v1':'synthetic-only-backup-v1',students,receipts:[]},summary:{students:identities.length,sourceRows:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length])),identicalDuplicateRowsPreserved:duplicates}};
}

export async function applySyntheticMigration(db,plan) {
  await verifyInitialized(db);
  // Rebuild from archive; never trust caller-provided plan documents/hash.
  const verified=planSyntheticMigration(plan.legacyArchive);if(plan.sourceDigest!==verified.sourceDigest||hash(plan.snapshot)!==hash(verified.snapshot))throw Error('Migration plan was changed');
  const requestId='migration_'+plan.sourceDigest;
  return db.transaction('__roster__',async q=>{
    await q('SELECT id FROM synthetic_meta WHERE id=1'+(db.kind==='postgres'?' FOR UPDATE':''));
    const all=await q('SELECT student_key,version FROM synthetic_students ORDER BY student_key'+(db.kind==='postgres'?' FOR UPDATE':''));
    const receipts=await q('SELECT student_key FROM synthetic_receipts WHERE request_id=?',[requestId]);
    if(receipts.length===25)return {success:true,alreadyApplied:true,students:25};
    if(receipts.length||all.some(r=>r.version!==0)||(await q('SELECT COUNT(*) n FROM synthetic_receipts'))[0].n!=0)throw Error('Destination used; no answer overwrite allowed');
    for(const row of verified.snapshot.students){
      await q('UPDATE synthetic_students SET document=?,version=? WHERE student_key=?',[row.document,row.version,row.student_key]);
      await q('INSERT INTO synthetic_receipts(student_key,request_id,fingerprint,state,result,expires_at) VALUES(?,?,?,?,?,?)',[row.student_key,requestId,plan.sourceDigest,'completed',JSON.stringify({success:true,version:row.version,sourceDigest:plan.sourceDigest}),Date.now()+86400000]);
    }
    return {success:true,students:25,alreadyApplied:false};
  });
}

export function prepareSyntheticRollback(migrationPlan,cutover,current) {
  const verified=planSyntheticMigration(migrationPlan.legacyArchive);
  if(verified.sourceDigest!==migrationPlan.sourceDigest)throw Error('Wrong migration source');
  for(const snap of [cutover,current]){
    if(snap?.format!=='synthetic-only-backup-v1'||snap.students?.length!==25||new Set(snap.students.map(r=>r.student_key)).size!==25)throw Error('Incomplete rollback snapshot');
    snap.students.forEach(row=>{const s=fixture.find(f=>f.studentKey===row.student_key),doc=JSON.parse(row.document);if(!s||JSON.stringify(s)!==row.identity||doc.studentKey!==s.studentKey||doc.googleId!==s.googleId)throw Error('Foreign rollback identity');});
  }
  let changed=0;for(const row of current.students){const old=cutover.students.find(r=>r.student_key===row.student_key);if(!Number.isSafeInteger(row.version)||row.version<old.version||row.version===old.version&&row.document!==old.document)throw Error('Rollback version conflict');if(row.version>old.version)changed++;}
  // Retain the original raw sheets and every current receipt, including pending/unknown.
  return {format:'synthetic-rollback-plan-v1',sourceDigest:verified.sourceDigest,legacyArchive:structuredClone(verified.legacyArchive),snapshot:structuredClone(current),summary:{students:25,postCutoverChangedStudents:changed,receiptsPreserved:current.receipts.length,overwriteOriginalSheets:false}};
}

export function encryptPrivateBackup(value,key) {
  if(!Buffer.isBuffer(key)||key.length!==32)throw Error('32-byte backup key required');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return JSON.stringify({format:'role-model-private-backup-v1',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});
}
export function decryptPrivateBackup(envelope,key) {
  const e=JSON.parse(envelope);if(e.format!=='role-model-private-backup-v1')throw Error('Wrong encrypted backup format');
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(e.iv,'base64'));decipher.setAuthTag(Buffer.from(e.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(e.data,'base64')),decipher.final()]).toString('utf8'));
}

export function makeLegacySyntheticFixture() {
  const identity=['studentKey','grade','classNum','number','name','googleId'];
  const values=s=>identity.map(k=>s[k]);
  return {format:'legacy-sheets-synthetic-v1',sheets:{
    Roster:[identity,...fixture.map(values)],
    Progress:[[...identity,'roleModelName','stepData','currentStep','isFinalSubmitted','unknownLegacyColumn'],...fixture.map((s,i)=>[...values(s),`기존모형${i}`,JSON.stringify({step1:{competencyCustom:`기존직접입력${i}`}}),10,true,`미지열${i}`])],
    Tests:[[...identity,'step8'],...fixture.map((s,i)=>[...values(s),JSON.stringify({tests:{test1:{result:'good',note:`기존시험${i}`}}})])],
    Submissions:[[...identity,'gemUrl','finalCareerReflection','submittedAt'],...fixture.map((s,i)=>[...values(s),'https://example.invalid/'+i,`기존최종${i}`,'2026-10-01T00:00:00.000Z'])]
  }};
}
