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
