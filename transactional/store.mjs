import {initializeMaintenance,admitWrite,maintenanceStatus} from './maintenance.mjs';
import {syntheticIdentity,registeredIdentity,rosterRows,changeRoster} from './roster.mjs';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {readFileSync} from 'node:fs';

export const fixture = Array.from({length:25}, (_,i)=>({studentKey:`3-1-${i+1}`,grade:3,classNum:1,number:i+1,name:`합성학생${i+1}`,googleId:`synthetic${i+1}@example.invalid`}));
const writes = new Set(['saveProgress','saveTests','updateRevision','submitFinal','submitCounseling']);
const normalize = x=>String(x||'').normalize('NFC').trim().replace(/\s+/g,'');
const json = x=>typeof x==='string'?JSON.parse(x):x;
const canonical = x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const digest = x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
const measuredQuery=q=>{const times={dbReadMs:0,dbWriteMs:0};return {times,query:async(sql,args)=>{const at=performance.now();try{return await q(sql,args);}finally{times[/^\s*SELECT/i.test(sql)?'dbReadMs':'dbWriteMs']+=performance.now()-at;}}};};
export class Fault extends Error { constructor(code,message){super(message);this.code=code;} }
export function assertSyntheticEnvironment(env=process.env) {
  if(env.TRANSACTIONAL_SYNTHETIC!=='synthetic-only-25' || env.VERCEL_ENV==='production' || env.NODE_ENV==='production' && env.VERCEL_ENV!=='preview') throw new Fault('DISABLED','합성 전용 저장소가 비활성 상태입니다.');
  if(!env.TRANSACTIONAL_SESSION_SECRET || env.TRANSACTIONAL_SESSION_SECRET.length<32) throw new Fault('CONFIG','합성 세션 서명 설정이 필요합니다.');
}

// SQLite is a local durable reference implementation, never a serverless storage path.
export function postgresOptions(url) {
  const parsed=new URL(url);
  if(!['postgresql:','postgres:'].includes(parsed.protocol))throw Error('PostgreSQL required');
  if(parsed.searchParams.has('sslmode')&&parsed.searchParams.get('sslmode')!=='verify-full')throw Error('Verified TLS required');
  if(['ssl','sslcert','sslkey','sslrootcert'].some(k=>parsed.searchParams.has(k)))throw Error('Use verified server TLS configuration');
  parsed.searchParams.delete('sslmode');
  const ssl={rejectUnauthorized:true};
  if(parsed.hostname.endsWith('.pooler.supabase.com')||parsed.hostname.endsWith('.supabase.co'))ssl.ca=readFileSync(new URL('./supabase-ca.crt',import.meta.url),'utf8');
  return {connectionString:parsed.toString(),ssl,max:10,connectionTimeoutMillis:5000,statement_timeout:8000};
}
export async function openDatabase({file,url,schema='role_model_synthetic',mode='synthetic'}) {
  if(mode!=='synthetic'&&mode!=='registered')throw new Error('Unknown database mode');
  const allowed=mode==='registered'?/^role_model_operating(?:_rehearsal_[a-z0-9_]+)?$/:/^role_model_synthetic(?:_rehearsal_[a-z0-9_]+)?$/;
  if(!allowed.test(schema))throw new Error('Database schema/mode mismatch');
  if(url) {
    if(!url.startsWith('postgresql://')&&!url.startsWith('postgres://')) throw new Error('PostgreSQL required');
    const {default:pg}=await import('pg');
    const pool=new pg.Pool(postgresOptions(url));
    pool.on('error',()=>console.warn(JSON.stringify({stage:'synthetic-db-idle-error'})));
    const wrap=c=>({query:async(sql,args=[])=>{let i=0;return (await c.query(sql.replace(/\bsynthetic_(meta|students|receipts|sessions|control)\b/g,schema+'.synthetic_$1').replace(/\?/g,()=>`$${++i}`),args)).rows;}});
    return {kind:'postgres',schema,query:wrap(pool).query,close:()=>pool.end(),transaction:async(key,fn,options={})=>{
      const queued=performance.now(),c=await pool.connect(), q=wrap(c).query; const start=performance.now();
      try {await q('BEGIN');await q("SET LOCAL lock_timeout = '4s'");if(options.write)await admitWrite(q,'postgres',options.issuedAt,options.epoch);await q('SELECT student_key FROM synthetic_students WHERE student_key=? FOR UPDATE',[key]);const acquired=performance.now(),measured=measuredQuery(q);const result=await fn(measured.query);const commitAt=performance.now();await q('COMMIT');return {...result,metrics:{...measured.times,poolWaitMs:start-queued,lockWaitMs:acquired-start,lockHeldMs:performance.now()-acquired,commitMs:performance.now()-commitAt}};}
      catch(e){await q('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
    }};
  }
  if(!file || file===':memory:') throw new Error('A local durable database file is required');
  const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=4000;');
  const query=async(sql,args=[])=>{const s=db.prepare(sql);return /^\s*(SELECT|PRAGMA)/i.test(sql)?s.all(...args):(s.run(...args),[]);};
  // Serialize only this connection's transaction scheduling. PostgreSQL locks individual students.
  let tail=Promise.resolve();
  return {kind:'sqlite-local',query,close:()=>db.close(),transaction(key,fn,options={}){const start=performance.now();const job=tail.then(async()=>{db.exec('BEGIN IMMEDIATE');const acquired=performance.now(),measured=measuredQuery(query);try{if(options.write)await admitWrite(query,'sqlite-local',options.issuedAt,options.epoch);const result=await fn(measured.query);const commitAt=performance.now();db.exec('COMMIT');return {...result,metrics:{...measured.times,poolWaitMs:0,lockWaitMs:acquired-start,lockHeldMs:performance.now()-acquired,commitMs:performance.now()-commitAt}};}catch(e){db.exec('ROLLBACK');throw e;}});tail=job.catch(()=>{});return job;}};
}

export async function initialize(db,{identities=fixture,registered=false}={}) {
  if(registered)identities=identities.map(s=>registeredIdentity(s));
  const marker=registered?'role-model-registered-rehearsal-v1':'role-model-synthetic-only-v1';
  if(db.kind==='postgres') await db.query('CREATE SCHEMA IF NOT EXISTS '+db.schema);
  await db.query('CREATE TABLE IF NOT EXISTS synthetic_meta (id INTEGER PRIMARY KEY, marker TEXT NOT NULL)');
  const meta=await db.query('SELECT marker FROM synthetic_meta');
  if(meta.length&&meta[0].marker!==marker) throw new Error('Database marker mismatch');
  await db.query('INSERT INTO synthetic_meta(id,marker) VALUES(1,?) ON CONFLICT(id) DO NOTHING',[marker]);
  await db.query('CREATE TABLE IF NOT EXISTS synthetic_students (student_key TEXT PRIMARY KEY, identity TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, document TEXT NOT NULL)');
  await db.query('CREATE TABLE IF NOT EXISTS synthetic_receipts (student_key TEXT NOT NULL REFERENCES synthetic_students(student_key), request_id TEXT NOT NULL, fingerprint TEXT, state TEXT NOT NULL, result TEXT, expires_at BIGINT NOT NULL, PRIMARY KEY(student_key,request_id))');
  await db.query('CREATE TABLE IF NOT EXISTS synthetic_sessions (id TEXT PRIMARY KEY, student_key TEXT NOT NULL REFERENCES synthetic_students(student_key), expires_at BIGINT NOT NULL)');
  for(const s of identities) await db.query('INSERT INTO synthetic_students(student_key,identity,document) VALUES(?,?,?) ON CONFLICT(student_key) DO NOTHING',[s.studentKey,JSON.stringify(s),JSON.stringify({...s,currentStep:1})]);
  await initializeMaintenance(db);
  await verifyInitialized(db,{registered,identities});
}
export async function verifyInitialized(db,{registered=false,identities=fixture}={}) {
  const meta=await db.query('SELECT marker FROM synthetic_meta WHERE id=1');
  if(meta.length!==1||meta[0].marker!==(registered?'role-model-registered-rehearsal-v1':'role-model-synthetic-only-v1'))throw new Error('Synthetic database not initialized');
  const rows=await db.query('SELECT student_key,identity FROM synthetic_students');
  if(rows.length<identities.length||rows.length>(registered?10000:100)||rows.some(r=>(registered?registeredIdentity:syntheticIdentity)(json(r.identity)).studentKey!==r.student_key)||identities.some(s=>!rows.some(r=>r.student_key===s.studentKey)))throw new Error('Synthetic fixture mismatch; no automatic deletion');
}

export function createService(db,secret,{validateIdentity=syntheticIdentity}={}) {
  if(secret.length<32) throw new Error('Signing secret too short');
  const sign=p=>{const b=Buffer.from(JSON.stringify(p)).toString('base64url');return b+'.'+createHmac('sha256',secret).update(b).digest('base64url');};
  const authenticate=async token=>{
    try {const [b,s,...rest]=String(token||'').split('.');const expected=createHmac('sha256',secret).update(b).digest();const actual=Buffer.from(s||'','base64url');if(rest.length||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error();const p=json(Buffer.from(b,'base64url').toString());if(p.exp<=Date.now())throw Error();const rows=await db.query('SELECT id FROM synthetic_sessions WHERE id=? AND student_key=? AND expires_at>?',[p.id,p.key,Date.now()]);if(!rows.length)throw Error();const [owner]=await db.query('SELECT identity,document FROM synthetic_students WHERE student_key=?',[p.key]);if(!owner||json(owner.document).rosterActive===false)throw Error();return {...p,identity:validateIdentity(json(owner.identity))};}catch{throw new Fault('AUTH','다시 로그인해 주세요.');}
  };
  const read=async key=>{const [r]=await db.query('SELECT document,version FROM synthetic_students WHERE student_key=?',[key]);return {...json(r.document),version:r.version};};
  const dispatch=async (p,{admin=false,adminEpoch}={})=>{
    const start=performance.now(); let result;
    if(p.action==='getRosterOptions'){const roster=(await rosterRows(db)).map(r=>json(r.identity));const grades=[...new Set(roster.map(s=>s.grade))].sort((a,b)=>a-b),classesByGrade={},numbersByClass={};for(const s of roster){(classesByGrade[s.grade]??=[]);if(!classesByGrade[s.grade].includes(s.classNum))classesByGrade[s.grade].push(s.classNum);(numbersByClass[s.grade+'-'+s.classNum]??=[]).push(s.number);}return {success:true,data:{grades,classesByGrade,numbersByClass},storageBackend:'transactional-synthetic'};}
    if(admin) {
      if(p.action==='checkAdminConfig')return {success:true};
      if(p.action==='getAdminDashboard'){const rows=await rosterRows(db),roster=rows.map(r=>json(r.identity)),students=rows.map(r=>({...json(r.document),version:r.version}));return {success:true,data:{students,roster,totalStudents:students.length}};}
      if(p.action==='getStudentDetail'){if(!(await rosterRows(db)).some(s=>s.student_key===p.studentKey))throw new Fault('SCOPE','합성 학생만 허용됩니다.');return {success:true,data:await read(p.studentKey)};}
      if(['updateRoster','deleteRosterStudents'].includes(p.action))return changeRoster(db,{...p,storageEpoch:adminEpoch},validateIdentity);throw new Fault('SCOPE','지원하지 않는 관리자 요청입니다.');
    }
    if(p.action==='verifyStudent') {
      const student=(await rosterRows(db)).map(r=>json(r.identity)).find(s=>s.grade===Number(p.grade)&&s.classNum===Number(p.classNo||p.classNum||p.class)&&s.number===Number(p.number)&&normalize(s.name)===normalize(p.name));
      if(!student)throw new Fault('AUTH','학생 정보를 확인할 수 없습니다.');
      const id=randomUUID(),exp=Date.now()+8*3600000;const {progress,epoch}=await db.transaction(student.studentKey,async q=>{const [row]=await q('SELECT document,version FROM synthetic_students WHERE student_key=?',[student.studentKey]);if(!row||json(row.document).rosterActive===false)throw new Fault('AUTH','학생 정보를 확인할 수 없습니다.');await q('INSERT INTO synthetic_sessions(id,student_key,expires_at) VALUES(?,?,?)',[id,student.studentKey,exp]);return {epoch:(await q('SELECT epoch FROM synthetic_control WHERE id=1'))[0].epoch,progress:{...json(row.document),version:row.version}};});
      return {success:true,student,studentToken:sign({id,key:student.studentKey,exp,epoch}),hasExisting:progress.version>0,progress,version:progress.version,storageEpoch:epoch,storageBackend:'transactional-synthetic'};
    }
    const session=await authenticate(p.studentToken), key=session.key;
    const input=p.progress||p.tests||p.submission||p.counseling||p;
    if(input.studentKey && input.studentKey!==key || p.studentKey && p.studentKey!==key)throw new Fault('SCOPE','다른 학생 자료에 접근할 수 없습니다.');
    if(p.action==='logoutStudent'){await db.query('DELETE FROM synthetic_sessions WHERE id=?',[session.id]);return {success:true};}
    if(['loadProgress','getProgress'].includes(p.action)){const data=await read(key);return {success:true,found:data.version>0,data,version:data.version,storageBackend:'transactional-synthetic'};}
    if(!writes.has(p.action)&&!['getSaveStatus','cancelSave'].includes(p.action))throw new Fault('SCOPE','지원하지 않는 합성 시험 요청입니다.');
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(p.requestId||''))throw new Fault('REQUEST','저장 요청 ID가 필요합니다.');
    const identity=session.identity;
    if(['name','googleId','grade','number','classNum','class'].some(k=>input[k]!==undefined && String(input[k])!==String(identity[k==='class'?'classNum':k])))throw new Fault('SCOPE','학생 신원이 일치하지 않습니다.');
    const intent={action:p.action,expectedVersion:p.expectedVersion,input:Object.fromEntries(Object.entries(input).filter(([k])=>!['studentToken','requestId','requestIssuedAt','expectedVersion','performanceRunId','storageEpoch'].includes(k)))};
    const fingerprint=digest(intent);
    result=await db.transaction(key,async q=>{
      const [row]=await q('SELECT version,document FROM synthetic_students WHERE student_key=?',[key]);if(!row||json(row.document).rosterActive===false)throw new Fault('AUTH','명단에서 제외된 학생입니다.');
      const [receipt]=await q('SELECT * FROM synthetic_receipts WHERE student_key=? AND request_id=?',[key,p.requestId]);
      if(p.action==='getSaveStatus')return {success:true,state:receipt?.state||'unknown',result:receipt?.result?json(receipt.result):undefined,version:(await q('SELECT version FROM synthetic_students WHERE student_key=?',[key]))[0].version};
      if(receipt){if(receipt.state==='cancelled')return {success:false,state:'cancelled',code:'CANCELLED',message:'취소된 요청입니다.'};if(p.action==='cancelSave')return {success:true,state:receipt.state,result:json(receipt.result)};if(receipt.fingerprint!==fingerprint)throw new Fault('ID_REUSE','요청 ID를 다른 저장에 사용할 수 없습니다.');return {...json(receipt.result),replayed:true};}
      if(p.action==='cancelSave'){await q('INSERT INTO synthetic_receipts(student_key,request_id,state,expires_at) VALUES(?,?,?,?)',[key,p.requestId,'cancelled',Date.now()+86400000]);return {success:true,state:'cancelled'};}
      if(!Number.isSafeInteger(p.requestIssuedAt)||Math.abs(Date.now()-p.requestIssuedAt)>15*60000)throw new Fault('EXPIRED','오래된 저장 요청입니다. 다시 확인해 주세요.');
      if(!Number.isSafeInteger(p.expectedVersion)||p.expectedVersion!==row.version)throw new Fault('VERSION_CONFLICT','다른 화면에서 변경되었습니다. 저장 내용을 다시 불러와 주세요.');
      const old=json(row.document), safe={};
      for(const [k,v] of Object.entries(input))if(!['action','studentKey','grade','class','classNum','number','name','googleId','studentToken','requestId','requestIssuedAt','expectedVersion','version','isFinalSubmitted','isGemSubmitted','createdAt','updatedAt','storageBackend','rosterActive','storageEpoch'].includes(k)&&!k.startsWith('__')&&k!=='constructor'&&k!=='prototype')safe[k]=v;
      let document={...old,...safe,...identity,stepData:{...old.stepData,...safe.stepData}};
      if(p.action==='saveTests')document={...document,step8:{...old.step8,...(input.step8||safe),tests:{...old.step8?.tests,...input.step8?.tests}},isTestCompleted:true};
      if(p.action==='updateRevision')document={...document,step6:input.step6||old.step6};
      if(p.action==='submitFinal')document={...document,step10:{...old.step10,...safe},isFinalSubmitted:true,isGemSubmitted:true,currentStep:10};
      if(p.action==='submitCounseling')document={...document,step11:safe,isCounselingCompleted:true};
      if(old.isFinalSubmitted)document.currentStep=10;
      const savedAt=new Date().toISOString();document.updatedAt=savedAt;document.createdAt=old.createdAt||savedAt;
      const version=row.version+1, response={success:true,state:'completed',studentKey:key,version,savedAt,...(p.action==='submitFinal'?{submittedAt:savedAt}:{}),storageBackend:'transactional-synthetic'};
      await q('UPDATE synthetic_students SET document=?,version=? WHERE student_key=?',[JSON.stringify(document),version,key]);
      await q('INSERT INTO synthetic_receipts(student_key,request_id,fingerprint,state,result,expires_at) VALUES(?,?,?,?,?,?)',[key,p.requestId,fingerprint,'completed',JSON.stringify(response),Date.now()+86400000]);
      return response;
    },{write:p.action!=='getSaveStatus',issuedAt:p.requestIssuedAt,epoch:session.epoch});
    return {...result,storageBackend:'transactional-synthetic',metrics:{...result.metrics,totalMs:performance.now()-start}};
  };
  return {dispatch,read,maintenanceStatus:()=>maintenanceStatus(db)};
}

export async function cleanupExpired(db,now=Date.now()) {
  let deleted=0;
  const control=await maintenanceStatus(db);
  if(control.closed)return {deleted:0,remaining:Number((await db.query('SELECT COUNT(*) n FROM synthetic_receipts'))[0].n),maintenance:true};
  // The same student lock as saving; recheck inside each transaction, at most 50.
  const candidates=await db.query("SELECT student_key,request_id FROM synthetic_receipts WHERE state IN ('completed','cancelled') AND expires_at<? LIMIT 50",[now]);
  for(const c of candidates)await db.transaction(c.student_key,async q=>{
    const rows=await q("SELECT request_id FROM synthetic_receipts WHERE student_key=? AND request_id=? AND state IN ('completed','cancelled') AND expires_at<?",[c.student_key,c.request_id,now]);
    if(rows.length){await q("DELETE FROM synthetic_receipts WHERE student_key=? AND request_id=? AND state IN ('completed','cancelled') AND expires_at<?",[c.student_key,c.request_id,now]);deleted++;}return {};
  },{write:true,issuedAt:Date.now(),epoch:control.epoch});
  const [row]=await db.query('SELECT COUNT(*) n FROM synthetic_receipts');return {deleted,remaining:Number(row.n)};
}

export async function createRegisteredService(db,secret) {
  await verifyInitialized(db,{registered:true,identities:[]});
  return createService(db,secret,{validateIdentity:registeredIdentity});
}
