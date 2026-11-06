import test from 'node:test';
import assert from 'node:assert/strict';
import {createCheckoutHttpHandler} from './checkout-http-boundary.mjs';
const payload={requestKey:'unique_request_key_1234',checkout:{name:'Demo'}};
const headers={'content-type':'application/json',authorization:'Bearer verified-demo-token'};
const request=(changes={})=>({method:'POST',headers,body:JSON.stringify(payload),...changes});
test('accepts validated request and returns minimal response, not customer details',async()=>{
 let received;const handle=createCheckoutHttpHandler({submitOrder:async x=>{received=x;return {created:true,orderId:'test-1',order:{status:'pending',customer:'private'}};}});
 const r=await handle(request());assert.equal(r.status,201);assert.deepEqual(JSON.parse(r.body),{orderId:'test-1',created:true,status:'pending'});assert.equal(received.idToken,'verified-demo-token');assert.equal(r.headers['cache-control'],'no-store');
});
test('rejects missing bearer token, wrong method, wrong media type and oversized body',async()=>{
 const handle=createCheckoutHttpHandler({submitOrder:async()=>{throw Error('should not execute')}});
 assert.equal((await handle(request({method:'GET'}))).status,405);
 assert.equal((await handle(request({headers:{'content-type':'application/json'}}))).status,401);
 assert.equal((await handle(request({headers:{'content-type':'text/plain'}}))).status,415);
 assert.equal((await handle(request({body:'x'.repeat(17000)}))).status,413);
});
test('rejects malformed JSON and invalid request key without calling service',async()=>{
 let count=0;const handle=createCheckoutHttpHandler({submitOrder:async()=>{count++;}});
 assert.equal((await handle(request({body:'{broken'}))).status,400);
 assert.equal((await handle(request({body:JSON.stringify({...payload,requestKey:'short'})}))).status,400);
 assert.equal(count,0);
});
test('maps conflicts and masks unknown server errors',async()=>{
 const conflict=createCheckoutHttpHandler({submitOrder:async()=>{throw Object.assign(Error('private'),{code:'KEY_REUSED'})}});
 assert.equal((await conflict(request())).status,409);
 const internal=createCheckoutHttpHandler({submitOrder:async()=>{throw Error('secret credentials')}});
 const result=await internal(request());assert.equal(result.status,500);assert.deepEqual(JSON.parse(result.body),{error:'INTERNAL_ERROR'});assert.doesNotMatch(result.body,/secret/);
});
test('idempotent replay returns 200 rather than 201',async()=>{
 const handle=createCheckoutHttpHandler({submitOrder:async()=>({created:false,orderId:'test-1',order:{status:'pending'}})});
 assert.equal((await handle(request())).status,200);
});
