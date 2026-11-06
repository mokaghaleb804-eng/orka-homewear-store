// Isolated end-to-end domain integration: fake verified tokens, catalog and memory storage.
// No browser, Firebase project, Admin SDK credentials, network, or production writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthorizedCheckout} from './authorized-checkout.mjs';
import {createAuthorizedFulfillment} from './authorized-fulfillment.mjs';
import {createMemoryOrderStore} from './order-service.mjs';
import {transitionOrder} from './order-fulfillment.mjs';
const catalog={model01:{name:'Demo look',active:true,priceCents:85000,sizes:['5-6Y']}};
const checkout={name:'Demo Customer',shippingPhone:'01012345678',governorate:'Giza',address:'Example street building 12',items:[{productId:'model01',size:'5-6Y',quantity:2}]};
const request={idToken:'customer-token',requestKey:'integration_request_12345',checkout};
function setup(){
 const store=createMemoryOrderStore(),orders=new Map();
 const verifyIdToken=async token=>{if(!['customer-token','admin-token','other-token'].includes(token))throw Error('revoked');return {uid:token==='admin-token'?'admin-1':token==='other-token'?'customer-2':'customer-1'}};
 const submit=createAuthorizedCheckout({verifyIdToken,loadCatalog:async()=>catalog,store,clock:()=> '2026-11-06T10:00:00.000Z'});
 const changeOrderStatus=async({orderId,nextStatus,actorRole})=>{const old=orders.get(orderId);if(!old)throw Error('ORDER_NOT_FOUND');const updated=transitionOrder(old,nextStatus,{actorRole,at:'2026-11-06T11:00:00.000Z'});orders.set(orderId,updated);return updated};
 const fulfill=createAuthorizedFulfillment({verifyIdToken,hasAdminRole:async uid=>uid==='admin-1',changeOrderStatus});
 return {store,orders,submit,fulfill};
}
test('verified customer checkout, idempotent retry, admin progression and audit timestamps',async()=>{
 const env=setup();
 const first=await env.submit({...request,uid:'admin-1',checkout:{...checkout,payableCents:1}});
 assert.equal(first.created,true);assert.equal(first.order.uid,'customer-1');assert.equal(first.order.payableCents,170000);
 env.orders.set(first.orderId,first.order);
 const retry=await env.submit(request);assert.equal(retry.created,false);assert.equal(retry.orderId,first.orderId);assert.equal(env.store.count(),1);
 for(const status of ['confirmed','preparing','shipped','delivered']){const result=await env.fulfill({idToken:'admin-token',orderId:first.orderId,nextStatus:status});assert.equal(result.status,status)}
 assert.equal(env.orders.get(first.orderId).deliveredAt,'2026-11-06T11:00:00.000Z');
 await assert.rejects(()=>env.fulfill({idToken:'admin-token',orderId:first.orderId,nextStatus:'pending'}),{code:'INVALID_TRANSITION'});
});
test('customer token cannot impersonate admin even if browser supplies role',async()=>{
 const env=setup();const first=await env.submit(request);env.orders.set(first.orderId,first.order);
 await assert.rejects(()=>env.fulfill({idToken:'customer-token',orderId:first.orderId,nextStatus:'confirmed',actorRole:'admin',uid:'admin-1'}),{code:'FORBIDDEN'});
 assert.equal(env.orders.get(first.orderId).status,'pending');
});
test('invalid token cannot create order or change status',async()=>{
 const env=setup();await assert.rejects(()=>env.submit({...request,idToken:'revoked'}),{code:'AUTH_INVALID'});assert.equal(env.store.count(),0);
 await assert.rejects(()=>env.fulfill({idToken:'revoked',orderId:'any',nextStatus:'confirmed'}),{code:'AUTH_INVALID'});
});
test('same idempotency key is scoped to verified customer identity',async()=>{
 const env=setup();const first=await env.submit(request);const second=await env.submit({...request,idToken:'other-token'});
 assert.notEqual(first.orderId,second.orderId);assert.equal(env.store.count(),2);
});
