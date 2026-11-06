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

test('untrusted browser totals and discounts cannot override trusted catalog',async()=>{
 const store=createMemoryOrderStore();
 let saved;
 const baseStore={
  createOnce:async(uid,key,build,fingerprint)=>{
   saved=build();
   return store.createOnce(uid,key,()=>saved,fingerprint);
  }
 };
 const submitOrder=createAuthorizedCheckout({
  verifyIdToken:async()=>({uid:'customer-one'}),
  loadCatalog:async()=>catalog,
  store:baseStore
 });
 const handle=createCheckoutHttpHandler({submitOrder});
 const response=await handle({
  method:'POST',
  headers:{'content-type':'application/json',authorization:'Bearer customer-one'},
  body:JSON.stringify({requestKey:'trusted_price_test_0001',checkout:{
   ...checkout,uid:'another-customer',subtotalCents:1,payableCents:1,
   discountCents:999999,loyaltyPoints:50000,
   items:[{...checkout.items[0],unitPriceCents:1,lineTotalCents:2}]
  }})
 });
 assert.equal(response.status,201);
 assert.equal(saved.uid,'customer-one');
 assert.equal(saved.subtotalCents,170000);
 assert.equal(saved.payableCents,170000);
 assert.equal(saved.discountCents,0);
 assert.equal(saved.loyaltyAccrued,false);
 assert.equal(saved.items[0].unitPriceCents,85000);
});
test('multiple line items cannot exceed approved aggregate size quantity',async()=>{
 const {store,send}=harness();
 const response=await send('customer-one','aggregate_qty_test_0001',{
  ...checkout,
  items:[
   {productId:'look-01',size:'7-8Y',quantity:15},
   {productId:'look-01',size:'7-8Y',quantity:10}
  ]
 });
 assert.equal(response.status,400);
 assert.deepEqual(JSON.parse(response.body),{error:'INVALID_ITEMS'});
 assert.equal(store.count(),0);
});

test('out-of-stock model and size never create an order',async()=>{
 const store=createMemoryOrderStore();
 const handle=createCheckoutHttpHandler({submitOrder:createAuthorizedCheckout({
  verifyIdToken:async()=>({uid:'customer-one'}),
  loadCatalog:async()=>({'look-01':{...catalog['look-01'],stockBySize:{'7-8Y':1}}}),
  store
 })});
 const response=await handle({
  method:'POST',headers:{'content-type':'application/json',authorization:'Bearer customer-one'},
  body:JSON.stringify({requestKey:'stock_limit_test_0001',checkout})
 });
 assert.equal(response.status,400);
 assert.deepEqual(JSON.parse(response.body),{error:'OUT_OF_STOCK'});
 assert.equal(store.count(),0);
});
test('two lines of the same size cannot bypass available stock',async()=>{
 const store=createMemoryOrderStore();
 const handle=createCheckoutHttpHandler({submitOrder:createAuthorizedCheckout({
  verifyIdToken:async()=>({uid:'customer-one'}),
  loadCatalog:async()=>({'look-01':{...catalog['look-01'],stockBySize:{'7-8Y':3}}}),
  store
 })});
 const response=await handle({
  method:'POST',headers:{'content-type':'application/json',authorization:'Bearer customer-one'},
  body:JSON.stringify({requestKey:'stock_aggregate_test_0001',checkout:{
   ...checkout,items:[
    {productId:'look-01',size:'7-8Y',quantity:2},
    {productId:'look-01',size:'7-8Y',quantity:2}
   ]
  }})
 });
 assert.equal(response.status,400);
 assert.deepEqual(JSON.parse(response.body),{error:'OUT_OF_STOCK'});
 assert.equal(store.count(),0);
});

test('unapproved product price blocks checkout without saving an order',async()=>{
 const store=createMemoryOrderStore();
 const handle=createCheckoutHttpHandler({submitOrder:createAuthorizedCheckout({
  verifyIdToken:async()=>({uid:'customer-one'}),
  loadCatalog:async()=>({'look-01':{...catalog['look-01'],priceCents:null}}),
  store
 })});
 const response=await handle({
  method:'POST',headers:{'content-type':'application/json',authorization:'Bearer customer-one'},
  body:JSON.stringify({requestKey:'unpriced_model_test_0001',checkout})
 });
 assert.equal(response.status,400);
 assert.deepEqual(JSON.parse(response.body),{error:'UNPRICED_PRODUCT'});
 assert.equal(store.count(),0);
});
test('inactive product cannot be ordered even with a valid price',async()=>{
 const store=createMemoryOrderStore();
 const handle=createCheckoutHttpHandler({submitOrder:createAuthorizedCheckout({
  verifyIdToken:async()=>({uid:'customer-one'}),
  loadCatalog:async()=>({'look-01':{...catalog['look-01'],active:false}}),
  store
 })});
 const response=await handle({
  method:'POST',headers:{'content-type':'application/json',authorization:'Bearer customer-one'},
  body:JSON.stringify({requestKey:'inactive_model_test_0001',checkout})
 });
 assert.equal(response.status,400);
 assert.deepEqual(JSON.parse(response.body),{error:'UNAVAILABLE_PRODUCT'});
 assert.equal(store.count(),0);
});

test('unapproved size is rejected without storing a request',async()=>{
 const {store,send}=harness();
 const response=await send('customer-one','invalid_size_test_0001',{
  ...checkout,items:[{productId:'look-01',size:'13-14Y',quantity:1}]
 });
 assert.equal(response.status,400);
 assert.deepEqual(JSON.parse(response.body),{error:'INVALID_SIZE'});
 assert.equal(store.count(),0);
});
test('invalid Egyptian shipping phone is rejected before order creation',async()=>{
 const {store,send}=harness();
 const response=await send('customer-one','invalid_phone_test_0001',{
  ...checkout,shippingPhone:'123456'
 });
 assert.equal(response.status,400);
 assert.deepEqual(JSON.parse(response.body),{error:'INVALID_PHONE'});
 assert.equal(store.count(),0);
});
test('missing delivery address cannot create an order',async()=>{
 const {store,send}=harness();
 const response=await send('customer-one','invalid_address_test_0001',{
  ...checkout,address:''
 });
 assert.equal(response.status,400);
 assert.deepEqual(JSON.parse(response.body),{error:'INVALID_ADDRESS'});
 assert.equal(store.count(),0);
});
