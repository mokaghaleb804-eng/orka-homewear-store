'use strict';
const assert=require('node:assert/strict');
const {grantForDelivery,redeemOneUnit}=require('./orka-club-wallet-transaction-contract.cjs');
// Synchronous serial transaction mock: NOT a concurrent/durable DB simulation.
function mockStore(){
 const credits=new Map(),operations=new Map();
 return {credits,operations,async transaction(fn){
  const tx={operation:k=>operations.get(k),putOperation:(k,v)=>operations.set(k,v),
   putCredit:(u,c)=>credits.set(u,[...(credits.get(u)||[]),c]),
   credits:u=>(credits.get(u)||[]).map(c=>({...c})),
   replaceCredits:(u,v)=>credits.set(u,v)};
  return fn(tx);
 }};
}
(async()=>{
 const s=mockStore(),order={id:'order-1',ownerUid:'uid-1',status:'delivered',source:'trusted-server',eligibleSubtotalPiastres:100000,fullPrice:true,usedWallet:false,deliveredAt:'2026-11-01T00:00:00Z'};
 assert.deepEqual(await grantForDelivery(s,{uid:'uid-1',order}),{amount:10000,orderId:'order-1'});
 assert.equal((await grantForDelivery(s,{uid:'uid-1',order})).amount,10000);
 assert.equal(s.credits.get('uid-1').length,1);
 await assert.rejects(grantForDelivery(s,{uid:'uid-2',order}),/Unverified order/);
 await assert.rejects(grantForDelivery(s,{uid:'uid-1',order:{...order,source:'client'}}),/Unverified order/);
 const input={uid:'uid-1',redemptionId:'redeem-1',orderId:'order-2',unitId:'unit-a',unitPricePiastres:8000,now:'2026-11-02T00:00:00Z'};
 const first=await redeemOneUnit(s,input);assert.equal(first.discount,8000);
 assert.deepEqual(await redeemOneUnit(s,input),first,'retry must replay original result');
 assert.equal(s.credits.get('uid-1')[0].remaining,2000);
 await assert.rejects(redeemOneUnit(s,{...input,unitPricePiastres:9000}),/Idempotency conflict/);
 console.log('Trusted wallet transaction contract mock tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
