import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirestoreOrderStore} from './firestore-order-store.mjs';
import {submitTrustedOrder} from './order-service.mjs';
// Fake transaction verifies adapter calls, NOT Firestore concurrency semantics.
function fakeDb(){
 const docs=new Map();let seq=0;
 const doc=(path,id)=>({id,path:path+'/'+id,collection(name){return collection(this.path+'/'+name)}});
 const collection=path=>({doc(id){return doc(path,id??'server-order-'+(++seq))}});
 return {
  collection,
  runTransaction:async callback=>callback({
   get:async ref=>({exists:docs.has(ref.path),data:()=>docs.get(ref.path)}),
   create:(ref,value)=>{if(docs.has(ref.path))throw Error('already exists');docs.set(ref.path,value)}
  }),
  count:()=>docs.size,
  read:path=>docs.get(path)
 };
}
const catalog={m1:{name:'Sample',active:true,priceCents:85000,sizes:['8']}};
const checkout={name:'Test Customer',shippingPhone:'01012345678',governorate:'Giza',address:'Example street, building 12',items:[{productId:'m1',size:'8',quantity:1}]};
const key='request_1234567890';
test('adapter stores order and idempotency record, then returns same order',async()=>{
 const db=fakeDb(),store=createFirestoreOrderStore(db);
 const args={uid:'customer-A',requestKey:key,checkout,catalog,store};
 const first=await submitTrustedOrder(args),retry=await submitTrustedOrder(args);
 assert.equal(first.created,true);
 assert.equal(retry.created,false);
 assert.equal(first.orderId,retry.orderId);
 assert.equal(db.count(),2);
 assert.equal(db.read('orders/'+first.orderId).uid,'customer-A');
 assert.equal(db.read('orders/'+first.orderId).payableCents,85000);
});
test('adapter refuses altered payload under same key',async()=>{
 const db=fakeDb(),store=createFirestoreOrderStore(db);
 await submitTrustedOrder({uid:'A',requestKey:key,checkout,catalog,store});
 await assert.rejects(()=>submitTrustedOrder({uid:'A',requestKey:key,checkout:{...checkout,name:'Changed'},catalog,store}),{code:'KEY_REUSED'});
 assert.equal(db.count(),2);
});
test('adapter requires server database',()=>assert.throws(()=>createFirestoreOrderStore(null),{code:'INVALID_STORE'}));
