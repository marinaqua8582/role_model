import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {assertSyntheticEnvironment,openDatabase,initialize,createService} from './store.mjs';
// Local-only harness, uses its own random administrator capability, never school credentials.
export async function startLocal({file,secret=randomBytes(32).toString('hex'),adminSecret=randomBytes(32).toString('hex'),port=0}) {
  assertSyntheticEnvironment({TRANSACTIONAL_SYNTHETIC:'synthetic-only-25',TRANSACTIONAL_SESSION_SECRET:secret});
  const db=await openDatabase({file}),service=createService(db,secret);await initialize(db);
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    try{
      if(req.method!=='POST'||!['/api/gas-proxy','/api/synthetic-admin'].includes(req.url)){res.writeHead(404);return res.end('{}');}
      let body='';for await(const c of req){body+=c;if(body.length>256000)throw Error('size');}
      let admin=false;
      if(req.url==='/api/synthetic-admin'){const actual=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+adminSecret);if(actual.length!==expected.length||!timingSafeEqual(actual,expected)){res.writeHead(403);return res.end('{}');}admin=true;}
      const result=await service.dispatch(JSON.parse(body),{admin});
      res.end(JSON.stringify(result));
    }catch(e){res.end(JSON.stringify({success:false,code:e.code||'UNAVAILABLE',message:e.code?e.message:'합성 시험 요청 실패',storageBackend:'transactional-synthetic'}));}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}`,adminSecret,service,db,close:async()=>{await new Promise(resolve=>server.close(resolve));await db.close();}};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url) {
  const app=await startLocal({file:process.env.TRANSACTIONAL_DB_FILE||'synthetic-local.sqlite',port:Number(process.env.PORT||3100)});
  console.log('Synthetic local API listening on '+app.url+'; private admin capability is not printed.');
}
