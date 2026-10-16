import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {encryptPrivateBackup,decryptPrivateBackup} from '../../transactional/migration.mjs';
import {planSourceArchive} from './source-plan.mjs';

const sheets=['Roster','Progress','Tests','Submissions'];
const hash=value=>createHash('sha256').update(value).digest('hex');
function validate(payload){
  if(payload?.format!=='role-model-native-sheet-source-v1'||payload.verification?.sourceDoubleReadMatched!==true||payload.verification?.noTestRowsExcluded!==true||payload.verification?.fullSelectionConfirmedByOperator!==true)throw Error('SOURCE_VALIDATION');
  const counts={};
  for(const sheet of sheets){
    const a=payload.first?.[sheet],b=payload.second?.[sheet];
    if(!a||!b||a.sheet!==sheet||b.sheet!==sheet||JSON.stringify(a.projection)!==JSON.stringify(b.projection))throw Error('SOURCE_MISMATCH');
    if(!a.rawFormats?.UnicodeText||!b.rawFormats?.UnicodeText||!Array.isArray(a.projection.grid)||a.projection.grid.length<1)throw Error('SOURCE_VALIDATION');
    const rows=a.projection.grid,width=rows[0].length;
    if(!width||rows.some(r=>r.length!==width)||a.projection.richCells.length!==rows.length||a.projection.richCells.some(r=>r.length!==width))throw Error('SOURCE_VALIDATION');
    counts[sheet]={selectedRows:rows.length,selectedColumns:width,dataRows:rows.slice(1).filter(r=>r.some(v=>v!=='')).length};
  }
  if(counts.Roster.dataRows<1)throw Error('EMPTY_ROSTER');
  return counts;
}
function keys(first,second){
  if(!/^[0-9a-fA-F]{64}$/.test(first||'')||!/^[0-9a-fA-F]{64}$/.test(second||''))throw Error('KEY_FORMAT');
  const a=Buffer.from(first,'hex'),b=Buffer.from(second,'hex');
  if(!timingSafeEqual(a,b)){a.fill(0);b.fill(0);throw Error('KEY_MISMATCH');}
  return [a,b];
}
export function verifyEncrypted(encrypted,key,expected){
  const restored=decryptPrivateBackup(encrypted,key),counts=validate(restored);
  if(expected&&JSON.stringify(restored)!==JSON.stringify(expected))throw Error('RESTORE_MISMATCH');
  return {counts,verified:true};
}
export function writeVerifiedArchive(folder,payload,keyHex,confirmHex){
  const counts=validate(payload),[key,confirm]=keys(keyHex,confirmHex);
  let encrypted;
  try{
    encrypted=encryptPrivateBackup(payload,key);
    verifyEncrypted(encrypted,confirm,payload);
    // An authenticated-backup check must reject both a damaged tag and a wrong key.
    const bad=JSON.parse(encrypted),tag=Buffer.from(bad.tag,'base64');tag[0]^=1;bad.tag=tag.toString('base64');
    let rejected=false;try{decryptPrivateBackup(JSON.stringify(bad),confirm);}catch{rejected=true;}if(!rejected)throw Error('TAG_CHECK');
    const wrong=Buffer.from(confirm);wrong[0]^=1;rejected=false;try{decryptPrivateBackup(encrypted,wrong);}catch{rejected=true;}finally{wrong.fill(0);}if(!rejected)throw Error('KEY_CHECK');
    const absolute=path.resolve(folder);
    if(fs.realpathSync(absolute)!==absolute)throw Error('FOLDER_REDIRECTION');
    for(let p=absolute;;p=path.dirname(p)){if(fs.lstatSync(p).isSymbolicLink())throw Error('FOLDER_REDIRECTION');if(path.dirname(p)===p)break;}
    const name='role_model_original_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+randomBytes(4).toString('hex');
    const pending=path.join(absolute,name+'.pending.enc'),final=path.join(absolute,name+'.verified.enc');
    const fd=fs.openSync(pending,'wx',0o600);
    try{fs.writeFileSync(fd,encrypted,'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    const readBack=fs.readFileSync(pending,'utf8');
    if(readBack!==encrypted)throw Error('DISK_MISMATCH');
    verifyEncrypted(readBack,confirm,payload);
    if(fs.existsSync(final))throw Error('NO_OVERWRITE');
    fs.renameSync(pending,final);
    verifyEncrypted(fs.readFileSync(final,'utf8'),confirm,payload);
    return {success:true,backupPath:final,ciphertextSha256:hash(readBack),counts,sourceCompared:true,decryptionVerified:true,tagTamperingRejected:true,wrongKeyRejected:true};
  }finally{key.fill(0);confirm.fill(0);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let chunks=[],size=0;
  try{
    for await(const chunk of process.stdin){size+=chunk.length;if(size>192*1024*1024)throw Error('INPUT_LIMIT');chunks.push(chunk);}
    const raw=Buffer.concat(chunks),input=JSON.parse(raw.toString('utf8'));raw.fill(0);chunks.forEach(c=>c.fill(0));chunks=[];
    let result;
    try{
      if(input.operation==='plan'){
        const [key,confirm]=keys(input.keyHex,input.confirmHex);
        try{
          const source=decryptPrivateBackup(fs.readFileSync(input.backupPath,'utf8'),key);
          const counts=validate(source),plan=planSourceArchive(source);
          // Read-only planning only: no database module is opened and no source data is written.
          const resultEnvelope={format:'role-model-operating-plan-v1',plan,source};
          const encrypted=encryptPrivateBackup(resultEnvelope,key);
          const equal=value=>JSON.stringify(value)===JSON.stringify(resultEnvelope);
          if(!equal(decryptPrivateBackup(encrypted,confirm)))throw Error('PLAN_VERIFY');
          const base=input.backupPath+'.migration-plan.'+randomBytes(4).toString('hex'),pending=base+'.pending.enc',final=base+'.verified.enc';
          if(path.dirname(path.resolve(final))!==path.resolve(input.folder))throw Error('FOLDER');
          const fd=fs.openSync(pending,'wx',0o600);try{fs.writeFileSync(fd,encrypted,'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
          if(!equal(decryptPrivateBackup(fs.readFileSync(pending,'utf8'),confirm)))throw Error('PLAN_VERIFY');
          fs.renameSync(pending,final);
          if(!equal(decryptPrivateBackup(fs.readFileSync(final,'utf8'),confirm)))throw Error('PLAN_VERIFY');
          result={success:true,phase:'read-only-migration-plan',planPath:final,counts,migration:plan.summary,databaseModified:false,sourceModified:false,productionDeployed:false};
        }finally{key.fill(0);confirm.fill(0);}
      }else if(input.operation==='verify'){
        const [key,confirm]=keys(input.keyHex,input.confirmHex);
        try{const encrypted=fs.readFileSync(input.backupPath,'utf8');result={success:true,...verifyEncrypted(encrypted,confirm),ciphertextSha256:hash(encrypted),sourceComparedNow:false};}finally{key.fill(0);confirm.fill(0);}
      }else if(input.operation==='seal') result=writeVerifiedArchive(input.folder,input.payload,input.keyHex,input.confirmHex);
      else throw Error('OPERATION');
    }finally{input.keyHex='';input.confirmHex='';}
    process.stdout.write(JSON.stringify(result));
  }catch(error){
    const kinds={'Ambiguous sheet header':'HEADER','Non-synthetic or ambiguous legacy identity':'IDENTITY','Identity/key conflict':'IDENTITY_KEY','Invalid legacy JSON':'JSON','Conflicting duplicate rows require manual resolution; source preserved':'DUPLICATE','Conflicting counseling/submission requires explicit resolution':'COUNSELING','Conflicting legacy step8 aliases require explicit resolution':'STEP8','DATE_TYPE_REQUIRES_REVIEW':'DATE_TYPE','CELL_TYPE_UNVERIFIED':'CELL_TYPE'};
    process.stdout.write(JSON.stringify({success:false,code:'BACKUP_REFUSED_OR_FAILED',errorKind:kinds[error.message]||'UNVERIFIED',pendingEncryptedFileMayExist:true}));process.exitCode=1;
  }
}
