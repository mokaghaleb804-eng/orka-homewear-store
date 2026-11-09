import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkoutAttempt,saveAttempt,attemptKey} from '../checkout/attempt-store.mjs';
function storage(){const rows=new Map();return {getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v)};}
const input={checkoutMode:'registered',customer:'Test',phone:'01012345678',gov:'القاهرة',address:'عنوان',notes:'',items:[{productId:'TEST-001',size:'6',qty:1}]};
test('refresh keeps the UUID, quote and pending result; does not store contact PII',async()=>{
 const s=storage(),a=await checkoutAttempt(s,'alice',input);a.stage='submitting';a.quote={quoteId:crypto.randomUUID(),totalEGP:295};saveAttempt(s,a);
 const restored=await checkoutAttempt(s,'alice',structuredClone(input));assert.equal(restored.requestId,a.requestId);assert.equal(restored.quote.quoteId,a.quote.quoteId);
 const raw=s.getItem(attemptKey('alice'));assert.ok(!raw.includes(input.phone));assert.ok(!raw.includes(input.address));
 await assert.rejects(checkoutAttempt(s,'alice',{...input,address:'changed'}));
});
test('new account cannot reuse previous identity key, and changed drafts get a new key',async()=>{
 const s=storage(),a=await checkoutAttempt(s,'alice',input),b=await checkoutAttempt(s,'bob',input);assert.notEqual(a.requestId,b.requestId);
 const changed=await checkoutAttempt(s,'alice',{...input,notes:'new'});assert.notEqual(changed.requestId,a.requestId);
});
test('a successful receipt persists and is returned on the same attempt',async()=>{
 const s=storage(),a=await checkoutAttempt(s,'alice',input);a.stage='complete';a.receipt={orderId:'abc',totalEGP:295};saveAttempt(s,a);
 assert.deepEqual((await checkoutAttempt(s,'alice',input)).receipt,a.receipt);
});
test('blocked or corrupt storage fails before an order can be submitted',async()=>{
 const s=storage();s.setItem(attemptKey('alice'),'invalid');await assert.rejects(checkoutAttempt(s,'alice',input));
 await assert.rejects(checkoutAttempt({getItem(){return null},setItem(){throw Error('blocked')}},'alice',input));
});
