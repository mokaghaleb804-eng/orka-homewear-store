'use strict';
const assert=require('node:assert/strict');
const {createFirestoreWalletGrantService}=require('./orka-club-firestore-grant-service.cjs');
function mockDb(order){
 const data=new Map([['orders/ord1',order]]);
 const db={doc:p=>({path:p}),runTransaction:async fn=>{
  const staged=[];
  const tx={get:async ref=>({exists:data.has(ref.path),data:()=>data.get(ref.path)}),
   create:(ref,value)=>staged.push([ref.path,value])};
  const result=await fn(tx);
  for(const [p,v] of staged){if(data.has(p))throw Error('Already exists');data.set(p,v)}
  return result;
 }};
 return {db,data};
}
(async()=>{
 const trusted={uid:'alice',status:'delivered',deliveryVerifiedByServer:true,eligibleSubtotalPiastres:100000,deliveredAt:{toDate:()=>new Date('2026-11-01T00:00:00Z')},fullPrice:true,usedWallet:false};
 const {db,data}=mockDb(trusted);
 const service=createFirestoreWalletGrantService(db);
 const first=await service.grantDeliveredOrder('ord1');assert.equal(first.amountPiastres,10000);
 const repeat=await service.grantDeliveredOrder('ord1');assert.deepEqual(repeat,{duplicate:true,amountPiastres:10000});
 assert.equal(data.get('wallets/alice/credits/grant_ord1').remaining,10000);
 for(const altered of [{...trusted,deliveryVerifiedByServer:false},{...trusted,eligibleSubtotalPiastres:undefined},{...trusted,uid:'a/b'}]){
  const s=createFirestoreWalletGrantService(mockDb(altered).db);
  await assert.rejects(s.grantDeliveredOrder('ord1'));
 }
 await assert.rejects(service.grantDeliveredOrder('../bad'),/Invalid order ID/);
 console.log('Server-only Firestore grant service mock contract tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
