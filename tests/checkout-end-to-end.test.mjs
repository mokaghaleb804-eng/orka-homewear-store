// Full isolated HTTP -> verified identity -> trusted pricing -> atomic storage journey.
// No live Firebase, payments, network requests or production writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCheckoutHttpHandler} from './checkout-http-boundary.mjs';
import {createAuthorizedCheckout} from './authorized-checkout.mjs';
import {createMemoryOrderStore} from './order-service.mjs';

const catalog={'look-01':{name:'ORKA demo model',active:true,priceCents:85000,sizes:['7-8Y']}};
const checkout={name:'Demo Customer',shippingPhone:'01012345678',governorate:'Giza',address:'Example street building 12',items:[{productId:'look-01',size:'7-8Y',quantity:2}]};
const requestKey='orka_e2e_request_0001';
function harness(){
 const store=createMemoryOrderStore();
 const submitOrder=createAuthorizedCheckout({
  verifyIdToken:async(token,checkRevoked)=>{
   assert.equal(checkRevoked,true);
   if(token==='revoked')throw Error('revoked');
   return {uid:token==='customer-two'?'customer-two':'customer-one'};
  },
  loadCatalog:async()=>catalog,
  store
 });
 const handle=createCheckoutHttpHandler({submitOrder});
 const send=(token='customer-one',key=requestKey,data=checkout)=>handle({
  method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},
  body:JSON.stringify({requestKey:key,checkout:data})
 });
 return {store,send};
}
test('complete isolated checkout creates trusted order once',async()=>{
 const {store,send}=harness();
 const first=await send();
 assert.equal(first.status,201);
 const created=JSON.parse(first.body);
 assert.equal(created.created,true);
 assert.equal(created.status,'pending');
 assert.equal(typeof created.orderId,'string');
 assert.equal(store.count(),1);
 const retry=await send();
 assert.equal(retry.status,200);
 assert.deepEqual(JSON.parse(retry.body),{...created,created:false});
 assert.equal(store.count(),1);
});
test('same request key with changed cart is rejected without extra order',async()=>{
 const {store,send}=harness();
 assert.equal((await send()).status,201);
 const changed={...checkout,items:[{...checkout.items[0],quantity:1}]};
 const response=await send('customer-one',requestKey,changed);
 assert.equal(response.status,409);
 assert.deepEqual(JSON.parse(response.body),{error:'KEY_REUSED'});
 assert.equal(store.count(),1);
});
test('independent customers get independent orders with same request key',async()=>{
 const {store,send}=harness();
 const a=JSON.parse((await send('customer-one')).body);
 const b=JSON.parse((await send('customer-two')).body);
 assert.notEqual(a.orderId,b.orderId);
 assert.equal(store.count(),2);
});
test('unavailable product never creates an order',async()=>{
 const {store,send}=harness();
 const response=await send('customer-one',requestKey,{...checkout,items:[{productId:'look-99',size:'7-8Y',quantity:1}]});
 assert.equal(response.status,400);
 assert.deepEqual(JSON.parse(response.body),{error:'UNAVAILABLE_PRODUCT'});
 assert.equal(store.count(),0);
});
test('revoked token never creates an order',async()=>{
 const {store,send}=harness();
 const response=await send('revoked');
 assert.equal(response.status,401);
 assert.deepEqual(JSON.parse(response.body),{error:'AUTH_INVALID'});
 assert.equal(store.count(),0);
});
test('simultaneous HTTP retries are idempotent',async()=>{
 const {store,send}=harness();
 const results=await Promise.all(Array.from({length:6},()=>send()));
 assert.equal(results.filter(r=>r.status===201).length,1);
 assert.equal(results.filter(r=>r.status===200).length,5);
 assert.equal(new Set(results.map(r=>JSON.parse(r.body).orderId)).size,1);
 assert.equal(store.count(),1);
});
