import {createHash} from 'node:crypto';

export async function initializeMaintenance(db) {
  await db.query('CREATE TABLE IF NOT EXISTS synthetic_control (id INTEGER PRIMARY KEY, closed INTEGER NOT NULL, epoch INTEGER NOT NULL, opened_at BIGINT NOT NULL)');
  await db.query('INSERT INTO synthetic_control(id,closed,epoch,opened_at) VALUES(1,0,0,0) ON CONFLICT(id) DO NOTHING');
}
// Shared admission locks retain student concurrency; the exclusive transition drains all admitted writers.
export async function admitWrite(q,kind,issuedAt,epoch) {
  if(kind==='postgres')await q('SELECT pg_advisory_xact_lock_shared(174014,1)');
  const [state]=await q('SELECT closed,epoch,opened_at FROM synthetic_control WHERE id=1');
  if(!state||state.closed)throw Object.assign(Error('서버 점검 중입니다. 입력 내용을 보관하고 잠시 후 확인해 주세요.'),{code:'MAINTENANCE'});
  if(state.epoch>0&&(epoch!==state.epoch||!Number.isSafeInteger(issuedAt)||issuedAt<Number(state.opened_at)))throw Object.assign(Error('전환 이전 요청입니다. 다시 로그인하여 상태를 확인해 주세요.'),{code:'STALE_EPOCH'});
}
export async function maintenanceStatus(db) {
  const [s]=await db.query('SELECT closed,epoch,opened_at FROM synthetic_control WHERE id=1');
  return {closed:Boolean(s.closed),epoch:s.epoch,openedAt:Number(s.opened_at)};
}
export async function setMaintenance(db,closed,{expectedEpoch}={}) {
  return db.transaction('__control__',async q=>{
    if(db.kind==='postgres')await q('SELECT pg_advisory_xact_lock(174014,1)');
    const [s]=await q('SELECT closed,epoch,opened_at FROM synthetic_control WHERE id=1');
    if(expectedEpoch!==undefined&&expectedEpoch!==s.epoch)throw Error('Maintenance epoch changed');
    if(Boolean(s.closed)===closed)return {...await maintenanceStatusFrom(q),drained:true};
    await q('UPDATE synthetic_control SET closed=?,epoch=?,opened_at=? WHERE id=1',[closed?1:0,s.epoch+1,closed?s.opened_at:Date.now()]);
    return {...await maintenanceStatusFrom(q),drained:true};
  });
}
async function maintenanceStatusFrom(q){const [s]=await q('SELECT closed,epoch,opened_at FROM synthetic_control WHERE id=1');return {closed:Boolean(s.closed),epoch:s.epoch,openedAt:Number(s.opened_at)};}
export async function stableSnapshot(db,exporter) {
  if(!(await maintenanceStatus(db)).closed)throw Error('Write freeze required');
  const a=await exporter(db),b=await exporter(db);
  const canonical=s=>JSON.stringify({students:s.students,receipts:s.receipts});
  if(canonical(a)!==canonical(b))throw Error('Source changed during freeze');
  return {snapshot:b,digest:createHash('sha256').update(canonical(b)).digest('hex')};
}
