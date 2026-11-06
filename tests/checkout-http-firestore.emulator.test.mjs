// HTTP -> authenticated checkout -> Firestore Emulator integration, no live Firebase.
// This file only runs inside the isolated emulator CI job.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createCheckoutHttpHandler} from './checkout-http-boundary.mjs';
import {createAuthorizedCheckout} from './authorized-checkout.mjs';
import {createFirestoreOrderStore} from './firestore-order-store.mjs';
if(!process.env.FIRESTORE_EMULATOR_HOST||process.env.GCLOUD_PROJECT!=='demo-orka-security')throw Error('Demo emulator required');
const app=initializeApp({projectId:'demo-orka-security'},'http-emulator-integration');
const db=getFirestore(app);
const catalog={demo:{name:'Demo only',active:true,priceCents:85000,sizes:['5-6Y']}};
const checkout={name:'Demo Buyer',shippingPhone:'01012345678',governorate:'Giza',address:'Example building number 15',items:[{productId:'demo',size:'5-6Y',quantity:1}]};
const authorized=createAuthorizedCheckout({
 verifyIdToken:async(token)=>{if(token!=='local-valid-token')throw Error('Invalid token');return {uid:'http-integration-user'};},
 loadCatalog:async()=>catalog,
 store:createFirestoreOrderStore(db)
});
const handle=createCheckoutHttpHandler({submitOrder:authorized});
const server=createServer(async(req,res)=>{
 const chunks=[];let length=0;
 for await(const chunk of req){length+=chunk.length;if(length>16384){res.writeHead(413);res.end();return;}chunks.push(chunk);}
 const result=await handle({method:req.method,headers:req.headers,body:Buffer.concat(chunks).toString('utf8')});
 res.writeHead(result.status,result.headers);res.end(result.body);
});
after(async()=>{if(server.listening)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await deleteApp(app);});
test('real localhost HTTP request creates one Firestore order and replay stays idempotent',async()=>{
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const url='http://127.0.0.1:'+server.address().port;
 const requestKey='http_emulator_integration_key_123';
 const post=(token,body)=>fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)});
 const body={requestKey,checkout};
 const invalid=await post('bad-token',body);assert.equal(invalid.status,401);
 const first=await post('local-valid-token',body);assert.equal(first.status,201);
 const created=await first.json();assert.equal(created.created,true);assert.equal(created.status,'pending');
 const replay=await post('local-valid-token',body);assert.equal(replay.status,200);
 assert.equal((await replay.json()).orderId,created.orderId);
 const persisted=await db.collection('orders').doc(created.orderId).get();
 assert.equal(persisted.exists,true);assert.equal(persisted.data().uid,'http-integration-user');
 assert.equal(persisted.data().payableCents,85000);
 const changed=await post('local-valid-token',{requestKey,checkout:{...checkout,address:'Another street building 20'}});
 assert.equal(changed.status,409);
 assert.equal((await db.collection('orders').doc(created.orderId).get()).data().address,checkout.address);
});
