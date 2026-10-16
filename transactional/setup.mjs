import {assertSyntheticEnvironment,openDatabase,initialize} from './store.mjs';
assertSyntheticEnvironment();
if(process.env.TRANSACTIONAL_INITIALIZE!=='CREATE_SYNTHETIC_25_ONLY')throw Error('Explicit synthetic initialization confirmation required');
const db=await openDatabase({url:process.env.TRANSACTIONAL_DATABASE_URL,file:process.env.TRANSACTIONAL_DB_FILE});
try {await initialize(db);console.log('Synthetic-only database initialized and 25 identities verified. No existing rows deleted.');}finally{await db.close();}
