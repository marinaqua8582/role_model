const {test}=require('node:test'),assert=require('node:assert/strict');
const {client}=require('./mock-client.cjs');
test('roster choices retain numeric class and grade-class keys for student login',async()=>{
 const state={apiCalls:0};
 const api=client('https://staging-fixture.vercel.app',state,async()=>({ok:true,status:200,json:async()=>({success:true,data:{grades:[3],classesByGrade:{'3':[99,1],'bad':[2]},numbersByClass:{'3-99':[25,1],'3-1':[2],'bad':[3]}}})}));
 const choices=await api.getRosterOptions();
 assert.deepEqual(JSON.parse(JSON.stringify(choices)),{grades:[3],classesByGrade:{'3':[1,99]},numbersByClass:{'3-99':[1,25],'3-1':[2]}});
 assert.equal((await api.getRosterOptions()).numbersByClass['3-99'][0],1);
 assert.equal(state.apiCalls,1);
});
