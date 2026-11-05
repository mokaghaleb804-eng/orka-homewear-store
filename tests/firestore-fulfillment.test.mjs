import test from 'node:test';
import assert from 'node:assert/strict';
import {createFulfillmentService} from './firestore-fulfillment.mjs';
const at='2026-11-06T12:00:00.000Z';
function fakeDb(initial){
 const data=new Map(Object.entries(initial));
 return {
  collection(name){return {doc(id){return {path:name+'/'+id}}}},
  runTransaction:async fn=>fn({
   get:async ref=>({exists:data.has(ref.path),data:()=>structuredClone(data.get(ref.path))}),
   update:(ref,patch)=>{data.set(ref.path,{...data.get(ref.path),...patch})}
  }),
  read:id=>data.get('orders/'+id)
 };
}
const order={uid:'u1',status:'pending',payableCents:85000,loyaltyAccrued:false};
test('authorized admin advances one stage and persists timestamp',async()=>{
 const db=fakeDb({'orders/o1':order});
 const change=createFulfillmentService(db,{serverNow:()=>at});
 const result=await change({orderId:'o1',nextStatus:'confirmed',actorRole:'admin'});
 assert.deepEqual(result,{orderId:'o1',status:'confirmed',loyaltyCredited:false});
 assert.equal(db.read('o1').statusUpdatedAt,at);
 assert.equal(db.read('o1').loyaltyAccrued,false);
});
test('non-admin cannot change order',async()=>{
 const db=fakeDb({'orders/o1':order});
 const change=createFulfillmentService(db);
 await assert.rejects(()=>change({orderId:'o1',nextStatus:'confirmed',actorRole:'customer'}),{code:'FORBIDDEN'});
 assert.equal(db.read('o1').status,'pending');
});
test('invalid transition cannot skip straight to delivered',async()=>{
 const db=fakeDb({'orders/o1':order});
 await assert.rejects(()=>createFulfillmentService(db)({orderId:'o1',nextStatus:'delivered',actorRole:'admin'}),{code:'INVALID_TRANSITION'});
 assert.equal(db.read('o1').status,'pending');
});
test('missing order rejected',async()=>{
 const db=fakeDb({});
 await assert.rejects(()=>createFulfillmentService(db)({orderId:'missing',nextStatus:'confirmed',actorRole:'admin'}),{code:'ORDER_NOT_FOUND'});
});
test('fulfillment never awards loyalty automatically',async()=>{
 const db=fakeDb({'orders/o1':{...order,status:'shipped'}});
 const result=await createFulfillmentService(db,{serverNow:()=>at})({orderId:'o1',nextStatus:'delivered',actorRole:'admin'});
 assert.equal(result.loyaltyCredited,false);
 assert.equal(db.read('o1').loyaltyAccrued,false);
 assert.equal(db.read('o1').deliveredAt,at);
});
