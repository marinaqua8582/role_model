// No credentials, database error text, or user records are printed.
import fs from 'node:fs';
import {postgresOptions} from '../../transactional/store.mjs';
import pg from 'pg';
let pool;
let stage='private-config';
const directDiagnostic=process.argv.includes('--direct-diagnostic');
try {
  const file=new URL('../../../operating-postgres.private.json',import.meta.url);
  const config=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  const url=new URL(config.databaseUrl);
  if(config.projectRef!=='rxzholiocjaczueobhsr'||config.schema!=='role_model_operating'||
     decodeURIComponent(url.username)!=='postgres.rxzholiocjaczueobhsr'||
     !/^aws-[0-9]+-ap-northeast-2\.pooler\.supabase\.com$/.test(url.hostname)||url.port!=='6543'||
     !config.databasePassword)throw Error('CONFIG');
  url.password=encodeURIComponent(config.databasePassword);
  config.databasePassword='';
  // Official rotation diagnosis: same project and password, verified TLS, read-only.
  // Does not change the saved pooler URI or operating configuration.
  if(directDiagnostic){url.hostname='db.rxzholiocjaczueobhsr.supabase.co';url.port='5432';url.username='postgres';}
  pool=new pg.Pool({...postgresOptions(url.href),max:1});
  stage='verified-tls-readonly';
  const client=await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query('SELECT 1');
    const result=await client.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='role_model_operating'");
    await client.query('ROLLBACK');
    console.info(JSON.stringify({success:true,connectionMode:directDiagnostic?'direct-diagnostic':'transaction-pooler',designatedOperatingProject:true,verifiedTls:true,readOnly:true,operatingSchemaTableCount:result.rows[0].n,recordsRead:false,databaseModified:false}));
  }finally{client.release();}
}catch(e){
  const allowed=['ENOTFOUND','EAI_AGAIN','ETIMEDOUT','ECONNREFUSED','ENETUNREACH','EACCES','EPERM','28P01','CERT_HAS_EXPIRED','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE'];
  console.info(JSON.stringify({success:false,connectionMode:directDiagnostic?'direct-diagnostic':'transaction-pooler',stage,errorKind:allowed.includes(e.code)?e.code:'CONFIG_OR_CONNECTION_FAILED',recordsRead:false,databaseModified:false}));process.exitCode=1;
}finally{if(pool)await pool.end();}
