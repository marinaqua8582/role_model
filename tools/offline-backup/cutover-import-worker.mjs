// Teacher-operated network step. Only the pinned operating DB receives the approved source.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {timingSafeEqual} from 'node:crypto';
import {openDatabase} from '../../transactional/store.mjs';
import {planSourceArchive} from './source-plan.mjs';
import {writeVerifiedArchive} from './crypto-worker.mjs';
import {importFrozenPlan,sealPrivateEnvelope} from './import-core.mjs';
let phase='input',db,key,input;
try{
  const chunks=[];let length=0;
  for await(const chunk of process.stdin){length+=chunk.length;if(length>192*1024*1024)throw Error('INPUT_LIMIT');chunks.push(chunk);}
  const raw=Buffer.concat(chunks);input=JSON.parse(raw.toString('utf8'));raw.fill(0);chunks.forEach(c=>c.fill(0));
  if(input.operation!=='APPROVED_OPERATING_IMPORT'||!/^[a-f0-9]{64}$/i.test(input.keyHex||'')||!/^[a-f0-9]{64}$/i.test(input.confirmHex||''))throw Error('CONFIRM');
  key=Buffer.from(input.keyHex,'hex');const confirm=Buffer.from(input.confirmHex,'hex');
  const matches=timingSafeEqual(key,confirm);confirm.fill(0);if(!matches)throw Error('KEY');
  const work=fileURLToPath(new URL('../../../',import.meta.url));
  const folder=path.resolve(input.folder),expected=path.join(process.env.USERPROFILE,'롤모델챗봇_운영백업');
  if(folder!==expected)throw Error('FOLDER');
  phase='freeze-attestation';
  const freeze=JSON.parse(fs.readFileSync(path.join(work,'operating-freeze-state.private.json'),'utf8'));
  if(freeze.closed!==true||freeze.gasProject!=='1Do2S3ypl0vLVFni460X2XhEFc20g0ArHQe9veAVScmL6OT_hB4ALITf1'||freeze.oldExecutionsDrained!==true||
     !Number.isSafeInteger(freeze.closedAt)||!Number.isSafeInteger(freeze.drainCompleteAt)||!Number.isSafeInteger(input.captureStartedAt)||
     input.captureStartedAt<freeze.drainCompleteAt||Date.now()<freeze.drainCompleteAt||freeze.drainCompleteAt<freeze.closedAt+360000)throw Error('FREEZE_NOT_CONFIRMED');
  phase='final-original-backup';
  const original=writeVerifiedArchive(folder,input.payload,input.keyHex,input.confirmHex);
  phase='source-plan';
  const plan=planSourceArchive(input.payload);
  const planPath=sealPrivateEnvelope(folder,{format:'role-model-operating-plan-v1',plan,source:input.payload,freeze},key,'frozen_migration_plan');
  phase='private-operating-connection';
  const config=JSON.parse(fs.readFileSync(path.join(work,'operating-postgres.private.json'),'utf8').replace(/^\uFEFF/,'')),url=new URL(config.databaseUrl);
  if(config.projectRef!=='rxzholiocjaczueobhsr'||config.schema!=='role_model_operating'||decodeURIComponent(url.username)!=='postgres.rxzholiocjaczueobhsr'||
     !/^aws-[0-9]+-ap-northeast-2\.pooler\.supabase\.com$/.test(url.hostname)||url.port!=='6543'||url.pathname!=='/postgres'||!config.databasePassword)throw Error('PROJECT');
  url.password=encodeURIComponent(config.databasePassword);config.databasePassword='';
  db=await openDatabase({url:url.href,mode:'registered',schema:'role_model_operating'});
  phase='import-and-reconcile';
  const result=await importFrozenPlan(db,plan,{folder,key});
  phase='final-freeze-check';
  const after=JSON.parse(fs.readFileSync(path.join(work,'operating-freeze-state.private.json'),'utf8'));
  if(after.closed!==true||after.epoch!==freeze.epoch||after.closedAt!==freeze.closedAt)throw Error('FREEZE_CHANGED');
  process.stdout.write(JSON.stringify({...result,phase:'operating-import-complete',backup:original,planPath,migration:plan.summary,sourceModified:false,gasClosed:true,productionDeployed:false}));
}catch{
  process.stdout.write(JSON.stringify({success:false,phase,sourceModified:false,productionDeployed:false,databaseMayBeInitialized:['import-and-reconcile','final-freeze-check'].includes(phase),message:'작업을 중단했습니다. 원본과 기존 백업은 유지하며 운영 저장은 개방하지 않습니다.'}));process.exitCode=1;
}finally{if(key)key.fill(0);if(input){input.keyHex='';input.confirmHex='';}if(db)await db.close();}
