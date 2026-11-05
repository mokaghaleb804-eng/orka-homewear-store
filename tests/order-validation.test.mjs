import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEgyptPhone,validateCheckout,makeOrderDraft} from './order-validation.mjs';
const sample={name:'Test Customer',shippingPhone:'01012345678',governorate:'Giza',address:'Example street, building 12',items:[{productId:'model-1',size:'8',quantity:2}]};
test('normalizes Egyptian mobile numbers',()=>{
 assert.equal(normalizeEgyptPhone('01012345678'),'+201012345678');
 assert.equal(normalizeEgyptPhone('+201012345678'),'+201012345678');
 assert.equal(normalizeEgyptPhone('00201012345678'),'+201012345678');
 assert.throws(()=>normalizeEgyptPhone('1234'));
});
test('checkout keeps shipping phone independent from social account phone',()=>{
 const order=makeOrderDraft({uid:'firebase-uid',phoneNumber:'+201111111111'},sample);
 assert.equal(order.customerUid,'firebase-uid');
 assert.equal(order.shippingPhone,'+201012345678');
 assert.equal(order.status,'draft');
});
test('guest order has no fabricated Firebase UID',()=>assert.equal(makeOrderDraft(null,sample).customerUid,null));
test('client-supplied amounts and loyalty are never copied',()=>{
 const order=makeOrderDraft({uid:'user-1'},{...sample,price:1,discount:9999,payableTotal:0,rewardCredit:5000,customerUid:'another-user'});
 for(const key of ['price','discount','payableTotal','rewardCredit']) assert.equal(Object.hasOwn(order,key),false);
 assert.equal(order.customerUid,'user-1');
});
test('rejects malformed quantities and addresses',()=>{
 assert.throws(()=>validateCheckout({...sample,items:[{productId:'x',size:'4',quantity:-2}]}));
 assert.throws(()=>validateCheckout({...sample,address:'x'}));
});
