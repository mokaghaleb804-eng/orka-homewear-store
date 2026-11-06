// Integration test against local Firestore Emulator using Admin SDK only.
// Must NEVER connect to live Firebase. No service-account credentials required.
import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {submitTrustedOrder} from './order-service.mjs';
import {createFirestoreOrderStore} from './firestore-order-store.mjs';
import {createFulfillmentService} from './firestore-fulfillment.mjs';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Refusing to run without FIRESTORE_EMULATOR_HOST');
if(process.env.GCLOUD_PROJECT!=='demo-orka-security')throw Error('Refusing non-demo Firebase project');
const app=initializeApp({projectId:'demo-orka-security'},'orka-integration-emulator');
const db=getFirestore(app);
const catalog={m1:{name:'Demo model',active:true,priceCents:85000,sizes:['5-6Y']}};
const checkout={name:'Demo Customer',shippingPhone:'01012345678',governorate:'Giza',address:'Example street building 12',items:[{productId:'m1',size:'5-6Y',quantity:2}]};
const store=createFirestoreOrderStore(db);
const requestKey='emulator_integration_123456789';
const uid='test-customer-1';
let createdId;
before(async()=>{await db.collection('orders').doc('emulator-seed').delete().catch(()=>{});});
after(async()=>{await deleteApp(app)});
test('atomic checkout creates one persisted Firestore order despite parallel retries',async()=>{
 const results=await Promise.all(Array.from({length:6},()=>submitTrustedOrder({uid,requestKey,checkout,catalog,store,clock:()=>new Date().toISOString()})));
 assert.equal(results.filter(r=>r.created).length,1);
 assert.equal(new Set(results.map(r=>r.orderId)).size,1);
 createdId=results[0].orderId;
 const snap=await db.collection('orders').doc(createdId).get();
 assert.equal(snap.exists,true);
 assert.equal(snap.data().uid,uid);
 assert.equal(snap.data().payableCents,170000);
 const key=await db.collection('orderRequests').doc(uid).collection('keys').doc(requestKey).get();
 assert.equal(key.data().orderId,createdId);
});
test('reusing same key with altered address is rejected and does not overwrite order',async()=>{
 await assert.rejects(()=>submitTrustedOrder({uid,requestKey,checkout:{...checkout,address:'Another street building 10'},catalog,store}),{code:'KEY_REUSED'});
 assert.equal((await db.collection('orders').doc(createdId).get()).data().customer,'Demo Customer');
});
test('server-only fulfillment persists valid transitions and rejects client role',async()=>{
 const change=createFulfillmentService(db,{serverNow:()=> '2026-11-06T12:00:00.000Z'});
 await assert.rejects(()=>change({orderId:createdId,nextStatus:'confirmed',actorRole:'customer'}),{code:'FORBIDDEN'});
 for(const status of ['confirmed','preparing','shipped','delivered']){
  const result=await change({orderId:createdId,nextStatus:status,actorRole:'admin'});
  assert.equal(result.status,status);
  assert.equal((await db.collection('orders').doc(createdId).get()).data().status,status);
 }
 const final=(await db.collection('orders').doc(createdId).get()).data();
 assert.equal(final.deliveredAt,'2026-11-06T12:00:00.000Z');
 assert.equal(final.loyaltyAccrued,false);
 await assert.rejects(()=>change({orderId:createdId,nextStatus:'confirmed',actorRole:'admin'}),{code:'INVALID_TRANSITION'});
});
