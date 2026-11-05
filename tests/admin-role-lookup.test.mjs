import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminRoleLookup} from './admin-role-lookup.mjs';
import {createAuthorizedFulfillment} from './authorized-fulfillment.mjs';
import {createFulfillmentService} from './firestore-fulfillment.mjs';
const docs=new Map([['admins/admin-1',{role:'admin'}],['admins/user-1',{role:'customer'}],['orders/o1',{status:'pending',uid:'buyer-1',payableCents:85000,loyaltyAccrued:false}]]);
function fakeDb(){
 return {
  collection(name){return {doc(id){const path=name+'/'+id;return {path,get:async()=>({exists:docs.has(path),data:()=>docs.get(path)})}}}},
  runTransaction:async fn=>fn({
   get:async ref=>({exists:docs.has(ref.path),data:()=>structuredClone(docs.get(ref.path))}),
   update:(ref,patch)=>docs.set(ref.path,{...docs.get(ref.path),...patch})
  })
 };
}
test('admin role is read from trusted record, not client claim',async()=>{
 const lookup=createAdminRoleLookup(fakeDb());
 assert.equal(await lookup('admin-1'),true);
 assert.equal(await lookup('user-1'),false);
 assert.equal(await lookup('missing'),false);
 assert.equal(await lookup('../admin-1'),false);
});
test('verified token + admin record + transactional fulfillment work together',async()=>{
 const db=fakeDb();
 const handle=createAuthorizedFulfillment({
  verifyIdToken:async token=>({uid:token==='valid-admin-token'?'admin-1':'user-1'}),
  hasAdminRole:createAdminRoleLookup(db),
  changeOrderStatus:createFulfillmentService(db,{serverNow:()=> '2026-11-06T12:00:00.000Z'})
 });
 await assert.rejects(()=>handle({idToken:'valid-user-token',orderId:'o1',nextStatus:'confirmed',actorRole:'admin'}),{code:'FORBIDDEN'});
 assert.equal(docs.get('orders/o1').status,'pending');
 const result=await handle({idToken:'valid-admin-token',orderId:'o1',nextStatus:'confirmed',actorRole:'customer'});
 assert.equal(result.status,'confirmed');
 assert.equal(docs.get('orders/o1').status,'confirmed');
 assert.equal(docs.get('orders/o1').loyaltyAccrued,false);
});
