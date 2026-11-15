'use strict';
const assert=require('node:assert/strict');
const {createFirestoreWalletRedeemService}=require('./orka-club-firestore-redeem-service.cjs');
function fake(){
 const docs=new Map([['wallets/alice/credits/g1',{remaining:10000,expiresAt:'2026-12-01T00:00:00Z'}],['orders/ord2',{uid:'alice',status:'pending',checkoutValidatedByServer:true,usedWallet:false,fullPrice:true,walletRedemptionUnit:{id:'unit1',pricePiastres:8000}}]]);
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
 const {db,docs}=fake(),service=createFirestoreWalletRedeemService(db);
 const input={uid:'alice',operationId:'red1',orderId:'ord2',unitId:'unit1',unitPricePiastres:8000,now:'2026-11-15T00:00:00Z'};
 const first=await service.redeemTrustedUnit(input);
 assert.equal(first.discountPiastres,8000);assert.equal(docs.get('wallets/alice/credits/g1').remaining,2000);
 assert.deepEqual(await service.redeemTrustedUnit(input),first);
 await assert.rejects(service.redeemTrustedUnit({...input,unitPricePiastres:9000}),/Untrusted checkout or price/);
 assert.equal(docs.get('wallets/alice/credits/g1').remaining,2000);
 await assert.rejects(service.redeemTrustedUnit({...input,uid:'../alice'}),/Invalid trusted redemption/);
 console.log('Firestore redeem service mock contract tests passed; emulator concurrency remains required');
})().catch(e=>{console.error(e);process.exitCode=1});
