import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthorizedCheckout} from './authorized-checkout.mjs';
import {createMemoryOrderStore} from './order-service.mjs';
const catalog={m1:{name:'Sample',active:true,priceCents:85000,sizes:['8']}};
const checkout={name:'Test Customer',shippingPhone:'01012345678',governorate:'Giza',address:'Example street, building 12',items:[{productId:'m1',size:'8',quantity:1}]};
const request={idToken:'valid-token',requestKey:'request_1234567890',checkout};
test('verified customer identity overrides browser uid and prices',async()=>{
 const handle=createAuthorizedCheckout({verifyIdToken:async(token,checkRevoked)=>{assert.equal(checkRevoked,true);return {uid:'verified-uid'}},loadCatalog:async()=>catalog,store:createMemoryOrderStore()});
 const result=await handle({...request,uid:'attacker',catalog:{m1:{priceCents:1}},checkout:{...checkout,uid:'attacker',payableCents:0}});
 assert.equal(result.order.uid,'verified-uid');
 assert.equal(result.order.payableCents,85000);
});
test('revoked or missing token blocks order creation',async()=>{
 const handle=createAuthorizedCheckout({verifyIdToken:async()=>{throw Error('revoked')},loadCatalog:async()=>catalog,store:createMemoryOrderStore()});
 await assert.rejects(()=>handle({...request,idToken:''}),{code:'AUTH_REQUIRED'});
 await assert.rejects(()=>handle(request),{code:'AUTH_INVALID'});
});
test('same authenticated request cannot create duplicate order',async()=>{
 const handle=createAuthorizedCheckout({verifyIdToken:async()=>({uid:'verified-uid'}),loadCatalog:async()=>catalog,store:createMemoryOrderStore()});
 const a=await handle(request),b=await handle(request);
 assert.equal(a.orderId,b.orderId);
 assert.equal(b.created,false);
});

test('simultaneous retry of same verified request creates only one order',async()=>{
 const store=createMemoryOrderStore();
 const handle=createAuthorizedCheckout({verifyIdToken:async()=>({uid:'verified-uid'}),loadCatalog:async()=>catalog,store});
 const results=await Promise.all(Array.from({length:8},()=>handle(request)));
 assert.equal(results.filter(r=>r.created).length,1);
 assert.equal(new Set(results.map(r=>r.orderId)).size,1);
 assert.equal(store.count(),1);
});
test('a different authenticated customer cannot read or reuse another customer order via key',async()=>{
 const store=createMemoryOrderStore();
 const handle=createAuthorizedCheckout({verifyIdToken:async(token)=>({uid:token==='customer-two'?'customer-two':'customer-one'}),loadCatalog:async()=>catalog,store});
 const first=await handle(request);
 const second=await handle({...request,idToken:'customer-two'});
 assert.notEqual(first.orderId,second.orderId);
 assert.equal(store.count(),2);
});
test('a reused key with modified delivery details is rejected',async()=>{
 const store=createMemoryOrderStore();
 const handle=createAuthorizedCheckout({verifyIdToken:async()=>({uid:'verified-uid'}),loadCatalog:async()=>catalog,store});
 await handle(request);
 await assert.rejects(()=>handle({...request,checkout:{...checkout,address:'Other street building 10'}}),{code:'KEY_REUSED'});
 assert.equal(store.count(),1);
});
test('invalid trusted catalog does not write an order',async()=>{
 const store=createMemoryOrderStore();
 const handle=createAuthorizedCheckout({verifyIdToken:async()=>({uid:'verified-uid'}),loadCatalog:async()=>({}),store});
 await assert.rejects(()=>handle(request),{code:'UNAVAILABLE_PRODUCT'});
 assert.equal(store.count(),0);
});

test('malformed verified customer identity cannot create an order',async()=>{
 for(const uid of ['', 'bad uid', '../customer', 'x'.repeat(129)]){
  let catalogLoaded=false;
  const store=createMemoryOrderStore();
  const handle=createAuthorizedCheckout({
   verifyIdToken:async()=>({uid}),
   loadCatalog:async()=>{catalogLoaded=true;return catalog},
   store
  });
  await assert.rejects(()=>handle(request),{code:'AUTH_INVALID'});
  assert.equal(catalogLoaded,false);
  assert.equal(store.count(),0);
 }
});
