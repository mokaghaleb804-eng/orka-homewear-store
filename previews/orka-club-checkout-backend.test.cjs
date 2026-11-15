'use strict';
const assert=require('node:assert/strict');
const {createOrkaClubCheckoutBackend}=require('./orka-club-checkout-backend.cjs');
const docs=new Map([
 ['catalog/sku1',{active:true,fullPrice:true,pricePiastres:85000}],
 ['shippingZones/giza',{active:true,pricePiastres:6000}]
]);
const firestore={
 doc:path=>({path,get:async()=>({exists:docs.has(path),data:()=>docs.get(path)})}),
 runTransaction:async fn=>{
  const writes=[];
  const tx={
   get:async ref=>({exists:docs.has(ref.path),data:()=>docs.get(ref.path)}),
   create:(ref,data)=>writes.push([ref.path,data])
  };
  const result=await fn(tx);
  for(const [path,data] of writes){if(docs.has(path))throw Error('Duplicate document');docs.set(path,data)}
  return result;
 }
};
let checkedRevocation=false;
const adminAuth={verifyIdToken:async(token,revoked)=>{
 checkedRevocation=revoked;
 if(token==='valid')return {uid:'alice',firebase:{sign_in_provider:'google.com'}};
 throw Error('Invalid token');
}};
(async()=>{
 const backend=createOrkaClubCheckoutBackend({adminAuth,firestore});
 const req={identityToken:'valid',orderId:'ord1',items:[{unitId:'u1',productId:'sku1'}],shippingAddress:{zoneId:'giza'},walletUnitId:'u1'};
 const result=await backend.createCheckout(req);
 assert.equal(result.order.totalPiastres,91000);
 assert.equal(result.order.walletRedemptionUnit.pricePiastres,85000);
 assert.equal(result.order.uid,'alice');
 assert.equal(checkedRevocation,true);
 assert.equal((await backend.createCheckout(req)).duplicate,true);
 await assert.rejects(backend.createCheckout({...req,orderId:'ord2',identityToken:'bad'}),/Invalid token/);
 await assert.rejects(backend.createCheckout({...req,orderId:'ord3',shippingAddress:{zoneId:'unknown'}}),/Shipping zone unavailable/);
 assert.equal(docs.has('orders/ord2'),false);
 assert.equal(docs.has('orders/ord3'),false);
 console.log('End-to-end server-only checkout composition mock tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
