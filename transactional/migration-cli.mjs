import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {assertSyntheticEnvironment,openDatabase} from './store.mjs';
import {exportSyntheticSnapshot,restoreSyntheticSnapshot} from './recovery.mjs';
import {makeLegacySyntheticFixture,planSyntheticMigration,applySyntheticMigration,prepareSyntheticRollback,encryptPrivateBackup,decryptPrivateBackup} from './migration.mjs';

const [command,folderArg]=process.argv.slice(2);
if(!folderArg)throw Error('Private output folder required (outside Git checkout)');
const folder=resolve(folderArg),repository=fileURLToPath(new URL('..',import.meta.url)),within=relative(repository,folder);
if(!within||within.split(sep)[0]!=='..'&&!isAbsolute(within))throw Error('Private backup must be outside source repository');
mkdirSync(folder,{recursive:true});
const keyPath=resolve(folder,'backup-key.private'),sealedPath=resolve(folder,'migration.private.backup');
let db;
try {
  if(command==='prepare-synthetic'){
    if(existsSync(keyPath)||existsSync(sealedPath))throw Error('Existing private backup is never overwritten');
    const key=randomBytes(32),plan=planSyntheticMigration(makeLegacySyntheticFixture());
    writeFileSync(keyPath,key,{flag:'wx',mode:0o600});writeFileSync(sealedPath,encryptPrivateBackup(plan,key),{flag:'wx',mode:0o600});
    console.log(JSON.stringify({prepared:true,...plan.summary,encrypted:true}));
  }else {
    assertSyntheticEnvironment();if(process.env.TRANSACTIONAL_MIGRATION_CONFIRM!=='SYNTHETIC_PRIVATE_MIGRATION_ONLY')throw Error('Explicit synthetic migration confirmation required');
    const key=readFileSync(keyPath),plan=decryptPrivateBackup(readFileSync(sealedPath,'utf8'),key);
    db=await openDatabase({file:process.env.TRANSACTIONAL_DB_FILE,url:process.env.TRANSACTIONAL_DATABASE_URL});
    if(command==='apply'){const r=await applySyntheticMigration(db,plan),backupPath=resolve(folder,'cutover.private.backup');if(!existsSync(backupPath)){const snapshot=await exportSyntheticSnapshot(db);writeFileSync(backupPath,encryptPrivateBackup(snapshot,key),{flag:'wx',mode:0o600});}console.log(JSON.stringify({applied:r.success,alreadyApplied:r.alreadyApplied,students:r.students}));}
    else if(command==='prepare-rollback'){const cutover=decryptPrivateBackup(readFileSync(resolve(folder,'cutover.private.backup'),'utf8'),key),current=await exportSyntheticSnapshot(db),rollback=prepareSyntheticRollback(plan,cutover,current);writeFileSync(resolve(folder,'rollback.private.backup'),encryptPrivateBackup(rollback,key),{flag:'wx',mode:0o600});console.log(JSON.stringify(rollback.summary));}
    else if(command==='restore-unused'){const rollback=decryptPrivateBackup(readFileSync(resolve(folder,'rollback.private.backup'),'utf8'),key);await restoreSyntheticSnapshot(db,rollback.snapshot);console.log(JSON.stringify({restored:true,students:25,originalSheetsModified:false}));}
    else throw Error('Unknown migration command');
  }
}catch{console.error('Synthetic migration/recovery refused or failed; private content was not logged.');process.exitCode=1;}
finally{if(db)await db.close();}
