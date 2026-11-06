import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCheckoutRequest} from './browser-checkout-payload.mjs';
import {createCheckoutHttpHandler} from './checkout-http-boundary.mjs';
const delivery={name:'Demo Buyer',phone:'01012345678',gov:'Giza',address:'Example building number 15'};
const cart=[{id:1,qty:2,size:'5-6Y'}];
test('browser demo bag maps to server checkout contract without prices or identity',async()=>{
 const payload=buildCheckoutRequest({cart,delivery,requestKey:'browser_contract_key_123'});
 assert.deepEqual(payload.checkout.items,[{productId:'look-01',size:'5-6Y',quantity:2}]);
 assert.equal(payload.checkout.shippingPhone,delivery.phone);
 assert.equal('price' in payload.checkout,false);
 assert.equal('uid' in payload.checkout,false);
 let submitted;
 const handle=createCheckoutHttpHandler({submitOrder:async x=>{submitted=x;return {created:true,orderId:'demo-1',order:{status:'pending'}}}});
 const result=await handle({method:'POST',headers:{'content-type':'application/json',authorization:'Bearer fake-test-token'},body:JSON.stringify(payload)});
 assert.equal(result.status,201);
 assert.deepEqual(submitted,{idToken:'fake-test-token',...payload});
});
test('browser adapter rejects empty bag, invalid sizes and request keys',()=>{
 for(const c of [[],[{id:1,qty:1,size:''}],[{id:11,qty:1,size:'5-6Y'}],[{id:1,qty:21,size:'5-6Y'}]])
  assert.throws(()=>buildCheckoutRequest({cart:c,delivery,requestKey:'browser_contract_key_123'}));
 assert.throws(()=>buildCheckoutRequest({cart,delivery,requestKey:'short'}),/INVALID_REQUEST_KEY/);
});
test('browser adapter ignores client-supplied prices, points and uid',()=>{
 const payload=buildCheckoutRequest({cart:[{...cart[0],price:1,points:999,uid:'admin'}],delivery:{...delivery,points:999},requestKey:'browser_contract_key_123'});
 assert.doesNotMatch(JSON.stringify(payload),/points|price|admin/);
});

test('offline checkout refuses missing or invalid delivery details',()=>{
 const cases=[
  [{...delivery,name:''},'INVALID_NAME'],
  [{...delivery,phone:'123'},'INVALID_PHONE'],
  [{...delivery,gov:''},'INVALID_GOVERNORATE'],
  [{...delivery,address:''},'INVALID_ADDRESS'],
  [{...delivery,address:'short'},'INVALID_ADDRESS']
 ];
 for(const [invalid,code] of cases)
  assert.throws(()=>buildCheckoutRequest({cart,delivery:invalid,requestKey:'browser_contract_key_123'}),new RegExp(code));
});
