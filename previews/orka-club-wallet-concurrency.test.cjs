'use strict';
const assert=require('node:assert/strict');
const {createSerializableTestStore}=require('./orka-club-wallet-serializable-test-store.cjs');
const {grantForDelivery,redeemOneUnit}=require('./orka-club-wallet-transaction-contract.cjs');
(async()=>{
 const store=createSerializableTestStore();
 const order={id:'delivery-1',ownerUid:'alice',status:'delivered',source:'trusted-server',eligibleSubtotalPiastres:100000,fullPrice:true,usedWallet:false,deliveredAt:'2026-11-01T00:00:00Z'};
 const grants=await Promise.all(Array.from({length:20},()=>grantForDelivery(store,{uid:'alice',order})));
 assert.equal(store.snapshot('alice').length,1);
 assert.ok(grants.every(x=>x.amount===10000));
 const make=(id)=>redeemOneUnit(store,{uid:'alice',redemptionId:id,orderId:'order-'+id,unitId:'unit',unitPricePiastres:8000,now:'2026-11-02T00:00:00Z'});
 const [a,b]=await Promise.all([make('a'),make('b')]);
 assert.equal(a.discount+b.discount,10000,'parallel operations must not overspend');
 assert.equal(store.snapshot('alice')[0].remaining,0);
 assert.deepEqual(await make('a'),a,'idempotent retry replays response');
 await assert.rejects(redeemOneUnit(store,{uid:'alice',redemptionId:'a',orderId:'tampered',unitId:'unit',unitPricePiastres:8000,now:'2026-11-02T00:00:00Z'}),/Idempotency conflict/);
 assert.equal(store.snapshot('alice')[0].remaining,0);
 console.log('In-process serializable adapter concurrency tests passed (not Firebase production proof)');
})().catch(e=>{console.error(e);process.exitCode=1});
