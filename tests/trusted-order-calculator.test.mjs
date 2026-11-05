import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateTrustedOrder} from './trusted-order-calculator.mjs';
const catalog={'model-1':{name:'Sample',active:true,priceCents:85000,sizes:['8','10'],stockBySize:{'8':10,'10':2}}};
const checkout={name:'Test Customer',shippingPhone:'01012345678',governorate:'Giza',address:'Example street, building 12',items:[{productId:'model-1',size:'8',quantity:2}]};
const make=(changes={},c=catalog)=>calculateTrustedOrder({authUid:'google-uid',checkout:{...checkout,...changes},catalog:c});
test('trusted catalog determines amount, not browser totals',()=>{
 const order=make({total:1,payableCents:0,discountCents:100000,points:9999,uid:'attacker'});
 assert.equal(order.subtotalCents,170000);
 assert.equal(order.payableCents,170000);
 assert.equal(order.discountCents,0);
 assert.equal(order.uid,'google-uid');
 assert.equal(order.shippingPhone,'+201012345678');
 assert.equal(order.shippingCents,null);
});
test('rejects missing approved price',()=>assert.throws(()=>make({}, {'model-1':{...catalog['model-1'],priceCents:0}}),{code:'UNPRICED_PRODUCT'}));
test('rejects inactive products and unknown products',()=>{
 assert.throws(()=>make({}, {'model-1':{...catalog['model-1'],active:false}}),{code:'UNAVAILABLE_PRODUCT'});
 assert.throws(()=>make({items:[{productId:'fake',size:'8',quantity:1}]}),{code:'UNAVAILABLE_PRODUCT'});
});
test('rejects invalid size, quantity, and insufficient stock',()=>{
 assert.throws(()=>make({items:[{productId:'model-1',size:'14',quantity:1}]}),{code:'INVALID_SIZE'});
 assert.throws(()=>make({items:[{productId:'model-1',size:'8',quantity:-1}]}),{code:'INVALID_ITEMS'});
 assert.throws(()=>make({items:[{productId:'model-1',size:'10',quantity:3}]}),{code:'OUT_OF_STOCK'});
});
test('rejects invalid phone and address',()=>{
 assert.throws(()=>make({shippingPhone:'123'}),{code:'INVALID_PHONE'});
 assert.throws(()=>make({address:'x'}),{code:'INVALID_ADDRESS'});
});
test('never grants loyalty credit at order creation',()=>{
 const order=make({rewardCreditUsed:100000,loyaltyAccrued:true});
 assert.equal(order.loyaltyAccrued,false);
 assert.equal(order.payableCents,170000);
});

test('duplicate lines cannot bypass per-size stock limits',()=>{
 assert.throws(()=>make({items:[{productId:'model-1',size:'10',quantity:2},{productId:'model-1',size:'10',quantity:2}]}),{code:'OUT_OF_STOCK'});
});
