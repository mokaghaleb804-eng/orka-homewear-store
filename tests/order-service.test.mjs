import test from 'node:test';
import assert from 'node:assert/strict';
import {submitTrustedOrder,createMemoryOrderStore} from './order-service.mjs';
const catalog={m1:{name:'Test model',active:true,priceCents:85000,sizes:['8'],stockBySize:{'8':10}}};
const checkout={name:'Test Customer',shippingPhone:'01012345678',governorate:'Giza',address:'Example street, building 12',items:[{productId:'m1',size:'8',quantity:1}]};
const key='request_1234567890';
const submit=(store,changes={})=>submitTrustedOrder({uid:'customer-1',requestKey:key,checkout:{...checkout,...changes},catalog,store});
test('first submission gets unique test order ID; retry returns same ID',async()=>{
 const store=createMemoryOrderStore();
 const first=await submit(store),again=await submit(store);
 assert.equal(first.created,true);
 assert.equal(again.created,false);
 assert.equal(first.orderId,again.orderId);
 assert.equal(store.count(),1);
 assert.equal(first.order.payableCents,85000);
});
test('same key cannot be reused for changed name, quantity or address',async()=>{
 const store=createMemoryOrderStore();await submit(store);
 await assert.rejects(()=>submit(store,{name:'Different Customer'}),{code:'KEY_REUSED'});
 await assert.rejects(()=>submit(store,{address:'Different street, building 10'}),{code:'KEY_REUSED'});
 await assert.rejects(()=>submit(store,{items:[{productId:'m1',size:'8',quantity:2}]}),{code:'KEY_REUSED'});
 assert.equal(store.count(),1);
});
test('unauthenticated request and weak key are rejected',async()=>{
 const store=createMemoryOrderStore();
 await assert.rejects(()=>submitTrustedOrder({uid:null,requestKey:key,checkout,catalog,store}),{code:'AUTH_REQUIRED'});
 await assert.rejects(()=>submitTrustedOrder({uid:'u',requestKey:'1',checkout,catalog,store}),{code:'INVALID_REQUEST_KEY'});
});
test('separate customer IDs may reuse request key without collision',async()=>{
 const store=createMemoryOrderStore();
 const first=await submit(store);
 const second=await submitTrustedOrder({uid:'customer-2',requestKey:key,checkout,catalog,store});
 assert.notEqual(first.orderId,second.orderId);
 assert.equal(store.count(),2);
});
test('fake price and discount cannot change stored total',async()=>{
 const store=createMemoryOrderStore();
 const result=await submit(store,{payableCents:0,discountCents:999999});
 assert.equal(result.order.payableCents,85000);
 assert.equal(result.order.discountCents,0);
});
