import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {initialize,verifyInitialized} from '../../transactional/store.mjs';
import {maintenanceStatus,setMaintenance} from '../../transactional/maintenance.mjs';
import {applyRegisteredMigration,exportRegisteredSnapshot,reconcileRegistered} from '../../transactional/registered.mjs';
import {planRegisteredMigration,encryptPrivateBackup,decryptPrivateBackup} from '../../transactional/migration.mjs';

export function sealPrivateEnvelope(folder,value,key,label){
  const absolute=path.resolve(folder);
  if(fs.realpathSync(absolute)!==absolute)throw Error('FOLDER_REDIRECTION');
  for(let p=absolute;;p=path.dirname(p)){if(fs.lstatSync(p).isSymbolicLink())throw Error('FOLDER_REDIRECTION');if(path.dirname(p)===p)break;}
  const envelope=encryptPrivateBackup(value,key),same=restored=>JSON.stringify(restored)===JSON.stringify(value);
  if(!same(decryptPrivateBackup(envelope,key)))throw Error('BACKUP_VERIFY');
  const base=path.join(absolute,'role_model_'+label+'_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+randomBytes(4).toString('hex'));
  const pending=base+'.pending.enc',final=base+'.verified.enc',fd=fs.openSync(pending,'wx',0o600);
  try{fs.writeFileSync(fd,envelope,'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  if(!same(decryptPrivateBackup(fs.readFileSync(pending,'utf8'),key)))throw Error('BACKUP_VERIFY');
  fs.renameSync(pending,final);
  if(!same(decryptPrivateBackup(fs.readFileSync(final,'utf8'),key)))throw Error('BACKUP_VERIFY');
  return final;
}

export async function importFrozenPlan(db,plan,{folder,key}){
  const verified=planRegisteredMigration(plan.legacyArchive,{excludeStudentKeys:['3-1-26','2003-1-26']});
  if(JSON.stringify(verified)!==JSON.stringify(plan))throw Error('PLAN_CHANGED');
  // Never initialize or add rows to a used destination. Only an exact prior import may replay.
  let exists;
  if(db.kind==='postgres')exists=Number((await db.query('SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=?',[db.schema]))[0].n)>0;
  else exists=(await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?",['synthetic_meta'])).length>0;
  if(exists){
    await verifyInitialized(db,{registered:true,identities:[]});
    if(!(await maintenanceStatus(db)).closed)throw Error('USED_DESTINATION_NOT_FROZEN');
  }else{
    await initialize(db,{registered:true,identities:plan.snapshot.students.map(row=>JSON.parse(row.identity))});
    await setMaintenance(db,true);
  }
  if(db.kind==='postgres'){
    // New operating schema is server-only; no browser/API roles can read its tables.
    await db.query('REVOKE ALL ON SCHEMA '+db.schema+' FROM PUBLIC, anon, authenticated');
    await db.query('REVOKE ALL ON ALL TABLES IN SCHEMA '+db.schema+' FROM PUBLIC, anon, authenticated');
  }
  const applied=await applyRegisteredMigration(db,plan),snapshot=await exportRegisteredSnapshot(db);
  const comparison=reconcileRegistered(plan,snapshot);
  const baselinePath=sealPrivateEnvelope(folder,{format:'role-model-operating-baseline-v1',plan,snapshot},key,'operating_baseline');
  const control=await maintenanceStatus(db);
  if(!control.closed)throw Error('DESTINATION_OPENED');
  return {success:true,alreadyApplied:applied.alreadyApplied===true,students:comparison.students,receipts:snapshot.receipts.length,documentsVersionsMatched:true,baselinePath,baselineDecryptionVerified:true,databaseClosed:true};
}
