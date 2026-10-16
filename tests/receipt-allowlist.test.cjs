const test=require('node:test'),assert=require('node:assert/strict');
const {backend}=require('./mock-runtime.cjs');
test('receipt allowlist deletes only expired completed/cancelled with finite numeric expiry',()=>{
  const b=backend(),p=b.context.PropertiesService.getScriptProperties(),old=Date.now()-1000,future=Date.now()+600000;
  const records={completed:{state:'completed',expiresAt:old},cancelled:{state:'cancelled',expiresAt:old},pending:{state:'pending',expiresAt:old},unknown:{state:'unknown',expiresAt:old},processing:{state:'processing',expiresAt:old},arbitrary:{state:'unexpected',expiresAt:old},missingState:{expiresAt:old},liveCompleted:{state:'completed',expiresAt:future},liveCancelled:{state:'cancelled',expiresAt:future},missingExpiry:{state:'completed'},stringExpiry:{state:'completed',expiresAt:String(old)},nullExpiry:{state:'cancelled',expiresAt:null},booleanExpiry:{state:'completed',expiresAt:false},badExpiry:{state:'cancelled',expiresAt:'invalid'},overflowExpiry:{state:'completed',expiresAt:Infinity},nullRecord:null,arrayRecord:[]};
  for(const [id,value] of Object.entries(records))p.setProperty('save-receipt:'+id,JSON.stringify(value));
  p.setProperty('save-receipt:overflowExpiry','{"state":"completed","expiresAt":1e999}');
  p.setProperty('save-receipt:parseFailure','not json');
  const before=p.getProperties(),r=b.context.purgeExpiredSaveReceipts();
  assert.equal(r.deleted,2);assert.equal(r.protectedPending,2);assert.equal(r.protectedUnknownState,5);assert.equal(r.invalidExpiresAt,6);assert.equal(r.malformed,1);assert.equal(r.deferredExpired,0);
  for(const id of Object.keys(before)){if(id.endsWith(':completed')||id.endsWith(':cancelled'))assert.equal(p.getProperty(id),undefined);else assert.equal(p.getProperty(id),before[id],id);}
  assert.equal(r.remaining,16);
});
test('cleanup status safely exposes new aggregates without property details',()=>{
  const b=backend(),p=b.context.PropertiesService.getScriptProperties();b.context.ScriptApp={getProjectTriggers:()=>[]};
  p.setProperty('SAVE_RECEIPT_CLEANUP_LAST',JSON.stringify({success:true,deleted:2,protectedPending:3,protectedUnknownState:4,invalidExpiresAt:5,malformed:6,deferredExpired:7,name:'private',googleId:'private',studentKey:'private'}));
  const r=b.context.getSaveReceiptCleanupStatus();assert.equal(r.last.protectedUnknownState,4);assert.equal(r.last.invalidExpiresAt,5);assert.equal(r.last.deleted,2);assert.equal(r.last.protectedPending,3);assert.equal(r.last.malformed,6);assert.equal(r.last.deferredExpired,7);assert.equal(JSON.stringify(r).includes('private'),false);
});
