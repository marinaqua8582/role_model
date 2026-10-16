// In-memory Sheets/Cache/Lock emulation. Never connects to Google services.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
class Sheet {
  constructor(name){this.name=name;this.rows=[];this.maxColumns=26;this.stats={reads:0,cells:0,full:0,writes:0};}
  getName(){return this.name;}
  getMaxColumns(){return Math.max(this.maxColumns,this.getLastColumn());}
  insertColumnsAfter(after,count){this.maxColumns=after+count;}
  getLastRow(){return this.rows.length;}
  getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length));}
  getRange(r,c,nr=1,nc=1){
    return {
      getValues:()=>{this.stats.reads++;this.stats.cells+=nr*nc;return Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>this.rows[r+i-1]?.[c+j-1]??''));},
      setValues:values=>{this.stats.writes++;values.forEach((row,i)=>row.forEach((v,j)=>{this.rows[r+i-1]||=[];this.rows[r+i-1][c+j-1]=v;}));},
      setValue:value=>{this.stats.writes++;this.rows[r-1]||=[];this.rows[r-1][c-1]=value;},
    };
  }
  getDataRange(){this.stats.full++;return this.getRange(1,1,this.getLastRow(),this.getLastColumn());}
  appendRow(row){this.stats.writes++;this.rows.push(Array.from(row));}
  deleteRow(index){this.rows.splice(index-1,1);}
}
function backend(code=fs.readFileSync(path.join(__dirname,'../GoogleAppsScript.latest.gs'),'utf8')){
  const sheets=new Map(),cache=new Map();let id=0;
  const ss={getId:()=> 'synthetic-spreadsheet',getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet(n);sheets.set(n,s);return s;}};
  const state={locked:false,denyLock:false,acquired:0,released:0,lockMs:0};
  let started=0;
  const receiptProps=new Map();
  const context={
    SpreadsheetApp:{getActiveSpreadsheet:()=>ss,flush(){}},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:()=>({setMimeType(){},setContent(text){this.text=text;}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='ADMIN_API_SECRET'?'test-admin-secret':receiptProps.get(k),setProperty:(k,v)=>receiptProps.set(k,v),getProperties:()=>Object.fromEntries(receiptProps),deleteProperty:k=>receiptProps.delete(k)})},
    CacheService:{getScriptCache:()=>({
      put:(k,v,ttl)=>cache.set(k,{value:v,expires:Date.now()+ttl*1000}),
      get:k=>{const v=cache.get(k);return v&&v.expires>Date.now()?v.value:null;},
      remove:k=>cache.delete(k),
    })},
    Utilities:{DigestAlgorithm:{SHA_256:"sha256"},computeDigest:(_a,v)=>Array.from(require("node:crypto").createHash("sha256").update(v).digest()),getUuid:()=>String(++id)},
    LockService:{getScriptLock:()=>({
      tryLock(){if(state.denyLock)return false;assert.equal(state.locked,false);state.locked=true;state.acquired++;started=performance.now();return true;},
      hasLock:()=>state.locked,
      releaseLock(){state.locked=false;state.released++;state.lockMs+=performance.now()-started;},
    })},
  };
  vm.createContext(context);vm.runInContext(code,context);context.initSheetsIfNeeded(ss);
  const roster=sheets.get('Roster');
  for(let n=1;n<=25;n++)roster.appendRow([3,1,n,'가상학생'+n,'mock'+n+'@example.invalid']);
  const withRequestId=p=>['saveProgress','saveTests','updateRevision','submitFinal','submitCounseling','resetStudentData'].includes(p.action) && !p.requestId ? {...p,requestId:'fixture_request_'+(++requestSequence).toString().padStart(12,'0'),requestIssuedAt:Date.now()} : p;
  let requestSequence=0;
  const request=p=>JSON.parse(context.handleRequest({postData:{contents:JSON.stringify(withRequestId(p))}}).text);
  const resetStats=()=>{for(const s of sheets.values())s.stats={reads:0,cells:0,full:0,writes:0};state.acquired=state.released=state.lockMs=0;batchStats.calls=batchStats.cells=0;};
  const stats=()=>({sheets:Object.fromEntries([...sheets].map(([n,s])=>[n,{...s.stats}])),locks:state.acquired,lockMs:state.lockMs,batchGet:batchStats.calls,batchCells:batchStats.cells});
  const batchStats={calls:0,cells:0};
  const enableBatch=()=>{receiptProps.set('LOGIN_BATCH_READS','enabled');context.Sheets={Spreadsheets:{Values:{batchGet:(_id,{ranges})=>{
    batchStats.calls++;
    return {valueRanges:ranges.map(range=>{
      const match=range.match(/^'([^']+)'!([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)$/); assert.ok(match,range);
      const [,name,c1,r1,c2,r2]=match, sheet=sheets.get(name), column=s=>Array.from(s).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
      const start=column(c1),width=column(c2)-start+1,height=Number(r2)-Number(r1)+1; batchStats.cells+=width*height;
      return {values:Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>sheet.rows[Number(r1)-1+i]?.[start-1+j]??''))};
    })};
  }}}};};
  return {sheets,cache,ss,state,context,request,stats,resetStats,enableBatch,batchStats};
}
module.exports={backend};
