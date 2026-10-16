// Deployment preflight: reads configuration only, never student records.
const fs=require('node:fs');
if(process.env.OPERATING_POSTGRES) {
  import('../transactional/operating-runtime.mjs').then(({operatingConfiguration})=>{
    operatingConfiguration();console.log('Operating PostgreSQL configuration validated; no student records accessed');
  }).catch(()=>{console.error('Operating PostgreSQL configuration rejected; private settings not logged');process.exitCode=1;});
} else {
if(process.env.TRANSACTIONAL_SYNTHETIC) {
  if(process.env.TRANSACTIONAL_SYNTHETIC!=='synthetic-only-25'||process.env.VERCEL_ENV!=='preview'||!process.env.TRANSACTIONAL_DATABASE_URL||!process.env.TRANSACTIONAL_SESSION_SECRET||process.env.TRANSACTIONAL_SESSION_SECRET.length<32)throw Error('Synthetic transactional preview configuration mismatch');
  if(process.env.STAGING_PERF_MODE)throw Error('Legacy GAS staging must be disabled for transactional preview');
  console.log('Synthetic transactional preview configured; GAS not contacted; database runtime verification required');process.exit(0);
}
const mode=process.env.VERCEL_ENV;
const synthetic=process.env.STAGING_PERF_MODE==='synthetic-25';
if(mode!=='production'&&!synthetic){console.log('GAS connection preflight: local/non-synthetic preview skipped');process.exit(0);}
const expected=mode==='production'
 ?'AKfycbzmtB28cj27SglDkQepd1DGlRRrv57LIRLipACLXRS1rSSiT0fPVtdrcNebKFg9X3nl'
 :'AKfycbx-mxvmnhDHeCEBONsythga7ODEvMLT6an2G_PevvZ5fp7Ktk1_MVcK0JIaBhNBjF0wQw';
const target=process.env.GAS_URL,secret=process.env.ADMIN_API_SECRET;
if(target!==`https://script.google.com/macros/s/${expected}/exec`||!secret)throw Error('GAS deployment preflight configuration mismatch');
if(mode==='production'&&synthetic)throw Error('Synthetic mode must never be enabled in production');
if(synthetic&&process.env.STAGING_GAS_ADMIN_SECRET!==secret)throw Error('Staging paired secrets differ');
(async()=>{const r=await fetch(target,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'checkAdminConfig',adminSecret:secret}),redirect:'follow',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('GAS configuration check HTTP failure');const d=await r.json();if(d.success!==true)throw Error('GAS configuration check rejected');console.log(JSON.stringify({event:'gas-deployment-preflight',environment:mode,expectedDeploymentMatched:true,adminConfigurationAccepted:true,studentDataRead:false}));})().catch(()=>{console.error('GAS deployment preflight failed; no credentials or upstream body logged');process.exitCode=1;});
}
