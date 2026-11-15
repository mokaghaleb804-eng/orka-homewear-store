'use strict';
const assert=require('node:assert/strict');
const {createFirestoreTrustedCheckoutService}=require('./orka-club-firestore-checkout-service.cjs');
const docs=new Map([['catalog/sku1',{active:true,fullPrice:true,pricePiastres:85000}]]);
const db={doc:path=>({path}),runTransaction:async fn=>{
 const writes=[];
 const tx={get:async ref=>({exists:docs.has(ref.path),data:()=>docs.get(ref.path)}),create:(ref,value)=>writes.push([ref.path,value])};
 const result=await fn(tx);
 for(const [path,value] of writes){if(docs.has(path))throw Error('Already exists');docs.set(path,value)}
 return result;
}};
const service=createFirestoreTrustedCheckoutService(db,{
 verifyIdentity:async token=>token==='verified-token'?{uid:'alice'}:null,
 resolveShipping:async()=>6000
});
(async()=>{
 const input={identityToken:'verified-token',orderId:'order1',items:[{unitId:'u1',productId:'sku1',pricePiastres:1,totalPiastres:1}],walletUnitId:'u1'};
 const first=await service.createCheckout(input);
 assert.equal(first.duplicate,false);
 assert.equal(first.order.uid,'alice');
 assert.equal(first.order.totalPiastres,91000);
 assert.equal(first.order.walletRedemptionUnit.pricePiastres,85000);
 assert.equal((await service.createCheckout(input)).duplicate,true);
 await assert.rejects(service.createCheckout({...input,identityToken:'invalid',orderId:'order2'}),/Invalid authenticated checkout/);
 await assert.rejects(service.createCheckout({...input,orderId:'order1',items:[{unitId:'u1',productId:'sku1'},{unitId:'u2',productId:'sku1'}]}),/idempotency conflict/);
 await assert.rejects(service.createCheckout({...input,orderId:'order3',items:[{unitId:'u1',productId:'missing'}]}),/Catalog product missing/);
 assert.equal(docs.has('orders/order2'),false);
 assert.equal(docs.has('orders/order3'),false);
 console.log('Trusted checkout Firestore adapter contract tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
