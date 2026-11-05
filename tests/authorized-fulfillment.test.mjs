import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthorizedFulfillment} from './authorized-fulfillment.mjs';
const request={idToken:'test-token',orderId:'o1',nextStatus:'confirmed',actorRole:'admin',uid:'spoofed'};
test('rejects missing, invalid or revoked tokens',async()=>{
 const handle=createAuthorizedFulfillment({verifyIdToken:async()=>{throw Error('revoked')},hasAdminRole:async()=>true,changeOrderStatus:async()=>({})});
 await assert.rejects(()=>handle({...request,idToken:''}),{code:'AUTH_REQUIRED'});
 await assert.rejects(()=>handle(request),{code:'AUTH_INVALID'});
});
test('rejects user with no verified admin claim even if request says admin',async()=>{
 let called=false;
 const handle=createAuthorizedFulfillment({verifyIdToken:async()=>({uid:'u1',admin:true}),hasAdminRole:async()=>false,changeOrderStatus:async()=>{called=true}});
 await assert.rejects(()=>handle(request),{code:'FORBIDDEN'});
 assert.equal(called,false);
});
test('verified admin identity authorizes transition and ignores spoofed role',async()=>{
 let passed;
 const handle=createAuthorizedFulfillment({verifyIdToken:async(token,checkRevoked)=>{assert.equal(checkRevoked,true);return {uid:'admin-1'}},hasAdminRole:async uid=>uid==='admin-1',changeOrderStatus:async args=>{passed=args;return {status:'confirmed'}}});
 const result=await handle({...request,actorRole:'customer'});
 assert.deepEqual(passed,{orderId:'o1',nextStatus:'confirmed',actorRole:'admin'});
 assert.equal(result.status,'confirmed');
});
