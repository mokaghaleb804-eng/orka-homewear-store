import test from 'node:test';
import assert from 'node:assert/strict';
import {createCheckoutHttpHandler} from './checkout-http-boundary.mjs';
const request={method:'POST',headers:{'content-type':'application/json',authorization:'Bearer demo'},body:JSON.stringify({requestKey:'demo_request_key_12345',checkout:{items:[]}})};
for(const [code,status] of [['UNAVAILABLE_PRODUCT',400],['UNPRICED_PRODUCT',400],['CATALOG_UNAVAILABLE',500],['TOTAL_OVERFLOW',500],['AUTH_INVALID',401],['KEY_REUSED',409]]){
 test('HTTP maps trusted '+code+' to '+status,async()=>{
  const handler=createCheckoutHttpHandler({submitOrder:async()=>{throw Object.assign(new Error('test'),{code});}});
  const result=await handler(request);
  assert.equal(result.status,status);
  assert.deepEqual(JSON.parse(result.body),{error:code});
  assert.equal(result.headers['cache-control'],'no-store');
 });
}
test('unknown server errors never leak exception text',async()=>{
 const handler=createCheckoutHttpHandler({submitOrder:async()=>{throw Error('private details');}});
 const result=await handler(request);
 assert.equal(result.status,500);
 assert.deepEqual(JSON.parse(result.body),{error:'INTERNAL_ERROR'});
});

test('HTTP rejects wrong method before invoking trusted checkout',async()=>{
 let called=false;
 const handler=createCheckoutHttpHandler({submitOrder:async()=>{called=true;}});
 const result=await handler({...request,method:'GET'});
 assert.equal(result.status,405);
 assert.equal(called,false);
});
test('HTTP rejects missing authentication without calling checkout',async()=>{
 let called=false;
 const handler=createCheckoutHttpHandler({submitOrder:async()=>{called=true;}});
 const result=await handler({...request,headers:{'content-type':'application/json'}});
 assert.equal(result.status,401);
 assert.equal(called,false);
});
test('HTTP rejects invalid JSON before invoking checkout',async()=>{
 let called=false;
 const handler=createCheckoutHttpHandler({submitOrder:async()=>{called=true;}});
 const result=await handler({...request,body:'not json'});
 assert.equal(result.status,400);
 assert.equal(called,false);
});
test('HTTP returns only minimal order fields on success',async()=>{
 const handler=createCheckoutHttpHandler({submitOrder:async()=>({created:true,orderId:'demo-order-1',order:{status:'pending',shippingPhone:'private',payableCents:85000}})});
 const result=await handler(request);
 assert.equal(result.status,201);
 assert.deepEqual(JSON.parse(result.body),{orderId:'demo-order-1',created:true,status:'pending'});
});

test('malformed headers return a controlled error',async()=>{
 const handler=createCheckoutHttpHandler({submitOrder:async()=>{throw Error('should not run');}});
 const result=await handler({...request,headers:null});
 assert.equal(result.status,400);
 assert.deepEqual(JSON.parse(result.body),{error:'INVALID_HEADERS'});
});
test('missing request body is rejected safely',async()=>{
 const handler=createCheckoutHttpHandler({submitOrder:async()=>{throw Error('should not run');}});
 const result=await handler({...request,body:undefined});
 assert.equal(result.status,400);
});
test('extra top-level client fields are rejected before checkout',async()=>{
 let called=false;
 const handler=createCheckoutHttpHandler({submitOrder:async()=>{called=true;}});
 const data=JSON.parse(request.body);
 const result=await handler({...request,body:JSON.stringify({...data,uid:'spoofed-user',role:'admin',priceCents:1})});
 assert.equal(result.status,400);
 assert.equal(called,false);
});
