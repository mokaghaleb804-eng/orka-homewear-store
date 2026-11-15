'use strict';
const assert=require('node:assert/strict');
const {createFirestoreWalletRedeemService}=require('./orka-club-firestore-redeem-service.cjs');
function fake(){
 const docs=new Map([['wallets/alice/credits/g1',{remaining:10000,expiresAt:'2026-12-01T00:00:00Z'}],['orders/ord2',{uid:'alice',status:'pending',checkoutValidatedByServer:true,usedWallet:false,fullPrice:true,eligibleSubtotalPiastres:8000,shippingPiastres:2500,totalPiastres:10500,units:[{id:'unit1',pricePiastres:8000}],walletRedemptionUnit:{id:'unit1',pricePiastres:8000}}]]);
 const ref=p=>({path:p});
 const db={doc:ref,collection:p=>({doc:u=>({collection:n=>({path:p+'/'+u+'/'+n})})}),
  runTransaction:async fn=>{
   const writes=[];
   const tx={get:async r=>{
    if(r.path==='wallets/alice/credits')return {docs:[...docs].filter(([p])=>p.startsWith('wallets/alice/credits/')).map(([p,v])=>({id:p.split('/').at(-1),ref:ref(p),data:()=>({...v})}))};
    return {exists:docs.has(r.path),data:()=>docs.get(r.path)};
   },update:(r,v)=>writes.push(['update',r.path,v]),create:(r,v)=>writes.push(['create',r.path,v])};
   const result=await fn(tx);
   for(const [type,p,v] of writes){if(type==='create'&&docs.has(p))throw Error('Exists');docs.set(p,type==='update'?{...docs.get(p),...v}:v)}
   return result;
  }};
 return {db,docs};
}
(async()=>{
 const {db,docs}=fake(),service=createFirestoreWalletRedeemService(db,{clock:()=>new Date('2026-11-15T00:00:00Z')});
 const input={uid:'alice',operationId:'red1',orderId:'ord2',unitId:'unit1',unitPricePiastres:8000};
 const first=await service.redeemTrustedUnit(input);
 assert.equal(first.discountPiastres,8000);assert.equal(first.payablePiastres,2500);assert.equal(docs.get('orders/ord2').payablePiastres,2500);assert.equal(docs.get('wallets/alice/credits/g1').remaining,2000);
 assert.deepEqual(await service.redeemTrustedUnit(input),first);
 assert.equal(docs.get('orders/ord2').walletRedemptionOperationId,'red1');
 await assert.rejects(service.redeemTrustedUnit({...input,operationId:'red2'}),/Order already redeemed/);
 await assert.rejects(service.redeemTrustedUnit({...input,unitPricePiastres:9000}),/Untrusted checkout or price/);
 assert.equal(docs.get('wallets/alice/credits/g1').remaining,2000);
 await assert.rejects(service.redeemTrustedUnit({...input,uid:'../alice'}),/Invalid trusted redemption/);
 docs.set('orders/ord-empty',{uid:'alice',status:'pending',checkoutValidatedByServer:true,usedWallet:false,fullPrice:true,eligibleSubtotalPiastres:8000,shippingPiastres:2500,totalPiastres:10500,units:[{id:'unit1',pricePiastres:8000}],walletRedemptionUnit:{id:'unit1',pricePiastres:8000}});
 await assert.rejects(createFirestoreWalletRedeemService(db,{clock:()=>new Date('2027-01-01T00:00:00Z')}).redeemTrustedUnit({...input,orderId:'ord-empty',operationId:'red-empty'}),/No eligible wallet credit/);
 assert.equal(docs.get('orders/ord-empty').usedWallet,false);
 assert.equal(docs.has('walletOperations/redeem_red-empty'),false);
 docs.set('orders/ord-time-spoof',{uid:'alice',status:'pending',checkoutValidatedByServer:true,usedWallet:false,fullPrice:true,eligibleSubtotalPiastres:8000,shippingPiastres:2500,totalPiastres:10500,units:[{id:'unit1',pricePiastres:8000}],walletRedemptionUnit:{id:'unit1',pricePiastres:8000}});
 await assert.rejects(createFirestoreWalletRedeemService(db,{clock:()=>new Date('2027-01-01T00:00:00Z')}).redeemTrustedUnit({...input,orderId:'ord-time-spoof',operationId:'red-time-spoof',now:'2026-11-01T00:00:00Z'}),/No eligible wallet credit/);
 assert.equal(docs.get('orders/ord-time-spoof').usedWallet,false);
 assert.equal(docs.has('walletOperations/redeem_red-time-spoof'),false);
 docs.set('orders/ord-bad-total',{uid:'alice',status:'pending',checkoutValidatedByServer:true,usedWallet:false,fullPrice:true,eligibleSubtotalPiastres:8000,shippingPiastres:2500,totalPiastres:1,units:[{id:'unit1',pricePiastres:8000}],walletRedemptionUnit:{id:'unit1',pricePiastres:8000}});
 await assert.rejects(service.redeemTrustedUnit({...input,orderId:'ord-bad-total',operationId:'red-bad-total'}),/Invalid trusted order totals/);
 assert.equal(docs.get('orders/ord-bad-total').usedWallet,false);
 docs.set('orders/ord-unit-mismatch',{uid:'alice',status:'pending',checkoutValidatedByServer:true,usedWallet:false,fullPrice:true,eligibleSubtotalPiastres:8000,shippingPiastres:2500,totalPiastres:10500,units:[{id:'unit1',pricePiastres:7000}],walletRedemptionUnit:{id:'unit1',pricePiastres:8000}});
 await assert.rejects(service.redeemTrustedUnit({...input,orderId:'ord-unit-mismatch',operationId:'red-unit-mismatch'}),/Untrusted checkout or price/);
 docs.set('orders/ord-unit-duplicate',{uid:'alice',status:'pending',checkoutValidatedByServer:true,usedWallet:false,fullPrice:true,eligibleSubtotalPiastres:8000,shippingPiastres:2500,totalPiastres:10500,units:[{id:'unit1',pricePiastres:8000},{id:'unit1',pricePiastres:8000}],walletRedemptionUnit:{id:'unit1',pricePiastres:8000}});
 await assert.rejects(service.redeemTrustedUnit({...input,orderId:'ord-unit-duplicate',operationId:'red-unit-duplicate'}),/Untrusted checkout or price/);
 console.log('Firestore redeem service mock contract tests passed; emulator concurrency remains required');
})().catch(e=>{console.error(e);process.exitCode=1});
