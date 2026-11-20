const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocs,collection,query,where,updateDoc,serverTimestamp}=require('firebase/firestore');
const functionRequire=require('node:module').createRequire(require('node:path').resolve('functions/package.json'));
const {initializeApp,deleteApp}=functionRequire('firebase-admin/app');
const {getFirestore,FieldValue}=functionRequire('firebase-admin/firestore');
const {HttpsError}=functionRequire('firebase-functions/v2/https');
const {createCheckoutService}=require('../functions/checkout-core');
const projectId='demo-orka-checkout';
if(!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:') || process.env.GCLOUD_PROJECT!==projectId) throw Error('Only the isolated demo emulator is allowed');
let env,app,db,api,clock,harness,strictHarness;
const user=(uid='alice',provider='google.com')=>({uid,token:{firebase:{sign_in_provider:provider}}});
const input=(overrides={})=>({requestId:crypto.randomUUID(),checkoutMode:'registered',customer:'عميل اختبار',phone:'01012345678',gov:'القاهرة',address:'عنوان تجريبي فقط',notes:'',items:[{productId:'TEST-001',size:'6',qty:1}],...overrides});
const call=(data,auth=user())=>({data,auth});
const error=code=>e=>e.code===code;
async function makeOrder(data=input(),auth=user()) {
  const quote=await api.quoteOrkaOrder(call(data,auth));
  const payload={...data,quoteId:quote.quoteId};
  return {quote,payload,result:await api.createOrkaOrder(call(payload,auth))};
}
before(async()=>{
  harness=require('node:child_process').spawn(process.execPath,['tests/callable-harness.cjs'],{env:{...process.env},stdio:['ignore','ignore','ignore']});
  let ready=false;
  for(let n=0;n<50;n++){try{if((await fetch('http://127.0.0.1:5001/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'Demo callable HTTP harness must start');
  strictHarness=require('node:child_process').spawn(process.execPath,['tests/callable-harness.cjs'],{env:{...process.env,ORKA_STRICT_APP_CHECK:'true'},stdio:['ignore','ignore','ignore']});
  ready=false;
  for(let n=0;n<50;n++){try{if((await fetch('http://127.0.0.1:5002/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'Strict App Check runner must start');
  env=await initializeTestEnvironment({projectId,firestore:{rules:fs.readFileSync('firestore.rules.secure-draft','utf8'),host:'127.0.0.1',port:8080}});
  app=initializeApp({projectId},'isolated-checkout');db=getFirestore(app);
  api=createCheckoutService({db,HttpsError,FieldValue,now:()=>clock});
});
beforeEach(async()=>{
  await env.clearFirestore();clock=Date.now();
  await db.doc('storeSettings/checkout').set({enabled:true,paymentMethod:'cod',catalogApproved:true,shippingApproved:true,abuseControlsApproved:true,shippingEGPByGovernorate:{'القاهرة':45}});
  await db.doc('catalog/TEST-001').set({active:true,priceEGP:250,name:'موديل وهمي للاختبار',sizes:['6','8'],maxPerOrder:3,inventoryMode:'made-to-order'});
  await db.doc('admins/admin').set({role:'admin'});
});
after(async()=>{harness?.kill();strictHarness?.kill();await env?.cleanup();if(app)await deleteApp(app);});
test('quote includes trusted shipping; creation freezes prices and disables loyalty',async()=>{
  const {quote,result}=await makeOrder();assert.equal(quote.totalEGP,295);
  const o=(await db.doc('orders/'+result.orderId).get()).data();
  assert.equal(o.total,295);assert.equal(o.subtotalEGP,250);assert.equal(o.uid,'alice');assert.equal(o.loyaltyEligible,false);assert.equal(o.pointsAwarded,false);
});
test('missing policy, each release flag, shipping and inactive catalog fail closed',async()=>{
  const ref=db.doc('storeSettings/checkout'),original=(await ref.get()).data();
  for(const key of ['enabled','catalogApproved','shippingApproved','abuseControlsApproved']) {
    await ref.set({...original,[key]:false});await assert.rejects(api.quoteOrkaOrder(call(input())),error('failed-precondition'));
  }
  await ref.delete();await assert.rejects(api.quoteOrkaOrder(call(input())),error('failed-precondition'));
  await ref.set({...original,shippingEGPByGovernorate:{}});await assert.rejects(api.quoteOrkaOrder(call(input())),error('failed-precondition'));
  await ref.set(original);await db.doc('catalog/TEST-001').update({active:false});await assert.rejects(api.quoteOrkaOrder(call(input())),error('failed-precondition'));
});
test('reject forged totals, prices, ownership and malformed quantities, paths and request IDs',async()=>{
  for(const patch of [{total:1},{uid:'victim'},{points:100},{requestId:'------------------------------------'},{phone:{fake:1}},{phone:'01012345678abc'},{gov:'Cairo'},{items:[{productId:'bad/path',size:'6',qty:1}]},{items:[{productId:'TEST-001',size:'6',qty:-1}]},{items:[{productId:'TEST-001',size:'6',qty:1,price:1}]}]) await assert.rejects(api.quoteOrkaOrder(call(input(patch))),error('invalid-argument'));
  assert.equal((await db.collection('orders').get()).size,0);
});
test('reject unknown SKU, invalid size, unsafe price, unsupported inventory and per-product caps across sizes',async()=>{
  for(const items of [[{productId:'UNKNOWN',size:'6',qty:1}],[{productId:'TEST-001',size:'10',qty:1}],[{productId:'TEST-001',size:'6',qty:2},{productId:'TEST-001',size:'8',qty:2}]]) await assert.rejects(api.quoteOrkaOrder(call(input({items}))),error('failed-precondition'));
  for(const patch of [{priceEGP:Number.MAX_SAFE_INTEGER+1},{maxPerOrder:0},{inventoryMode:'stock'},{name:''}]) {
    await db.doc('catalog/TEST-001').set({active:true,priceEGP:250,name:'Test',sizes:['6'],maxPerOrder:3,inventoryMode:'made-to-order',...patch});
    await assert.rejects(api.quoteOrkaOrder(call(input())),error('failed-precondition'));
  }
});
test('same attempt concurrent submissions and lost-response retry return exactly one order',async()=>{
  const data=input(),q=await api.quoteOrkaOrder(call(data)),payload={...data,quoteId:q.quoteId};
  const results=await Promise.all(Array.from({length:6},()=>api.createOrkaOrder(call(payload))));
  assert.equal(new Set(results.map(r=>r.orderId)).size,1);assert.equal((await db.collection('orders').get()).size,1);
  clock+=600000;await db.doc('storeSettings/checkout').delete();
  const replay=await api.createOrkaOrder(call(payload));assert.equal(replay.reused,true);
  await assert.rejects(api.createOrkaOrder(call({...payload,address:'عنوان مختلف جديد'})),error('already-exists'));
});
test('line reordering is the same canonical attempt',async()=>{
  const data=input({items:[{productId:'TEST-001',size:'8',qty:1},{productId:'TEST-001',size:'6',qty:1}]});
  const {payload,result}=await makeOrder(data);
  const replay=await api.createOrkaOrder(call({...payload,items:[...payload.items].reverse()}));assert.equal(replay.orderId,result.orderId);
});
test('expired, foreign and changed quotes cannot create orders',async()=>{
  const data=input(),q=await api.quoteOrkaOrder(call(data)),p={...data,quoteId:q.quoteId};
  await assert.rejects(api.createOrkaOrder(call(p,user('bob'))),error('failed-precondition'));
  await assert.rejects(api.createOrkaOrder(call({...p,address:'عنوان مختلف جديد'})),error('failed-precondition'));
  await db.doc('catalog/TEST-001').update({priceEGP:251});await assert.rejects(api.createOrkaOrder(call(p)),error('failed-precondition'));
  await db.doc('catalog/TEST-001').update({priceEGP:250});await db.doc('storeSettings/checkout').update({'shippingEGPByGovernorate.القاهرة':46});await assert.rejects(api.createOrkaOrder(call(p)),error('failed-precondition'));
  clock+=300001;await assert.rejects(api.createOrkaOrder(call(p)),error('failed-precondition'));
  assert.equal((await db.collection('orders').get()).size,0);
});
test('registered and guest identity modes are derived from auth, never contact phone',async()=>{
  await assert.rejects(api.quoteOrkaOrder(call(input(),null)),error('unauthenticated'));
  await assert.rejects(api.quoteOrkaOrder(call(input(),user('guest','anonymous'))),error('invalid-argument'));
  const {result}=await makeOrder(input({checkoutMode:'guest'}),user('guest','anonymous'));
  assert.equal((await db.doc('orders/'+result.orderId).get()).data().uid,'guest');
  assert.equal((await db.collection('customers').get()).size,0);
});
test('UID rate limiting covers new quotes and orders but not successful retries',async()=>{
  const {payload}=await makeOrder();await assert.rejects(api.quoteOrkaOrder(call(input())),error('resource-exhausted'));
  clock+=15001;const data=input(),q=await api.quoteOrkaOrder(call(data));clock-=15001;
  await assert.rejects(api.createOrkaOrder(call({...data,quoteId:q.quoteId})),error('resource-exhausted'));
  assert.equal((await api.createOrkaOrder(call(payload))).reused,true);
});
test('admin status transitions are transactional, audited, retry-safe and never award points',async()=>{
  const {result}=await makeOrder();
  const step={requestId:crypto.randomUUID(),orderId:result.orderId,nextStatus:'preparing',reason:''};
  await assert.rejects(api.updateOrkaOrderStatus(call(step)),error('permission-denied'));
  const [a,b]=await Promise.all([api.updateOrkaOrderStatus(call(step,user('admin'))),api.updateOrkaOrderStatus(call(step,user('admin')))]);
  assert.equal(a.status,b.status);assert.equal((await db.doc('orders/'+result.orderId).collection('statusHistory').get()).size,1);
  await assert.rejects(api.updateOrkaOrderStatus(call({...step,nextStatus:'shipped'},user('admin'))),error('already-exists'));
  for(const nextStatus of ['shipped','delivered']) await api.updateOrkaOrderStatus(call({...step,requestId:crypto.randomUUID(),nextStatus},user('admin')));
  const o=(await db.doc('orders/'+result.orderId).get()).data();assert.equal(o.pointsAwarded,false);assert.equal(o.status,'delivered');
  await assert.rejects(api.updateOrkaOrderStatus(call({...step,requestId:crypto.randomUUID(),nextStatus:'cancelled',reason:'سبب إلغاء صحيح'},user('admin'))),error('failed-precondition'));
});
test('cancellation reason and TEST isolation enforced on server',async()=>{
  const {result}=await makeOrder(),step={requestId:crypto.randomUUID(),orderId:result.orderId,nextStatus:'cancelled',reason:'لا'};
  await assert.rejects(api.updateOrkaOrderStatus(call(step,user('admin'))),error('invalid-argument'));
  for(const flag of [{isTest:true},{test:true},{localOnly:true},{environment:'test'},{orderType:'test'}]) {
    await db.doc('orders/'+result.orderId).update(flag);await assert.rejects(api.updateOrkaOrderStatus(call({...step,reason:'سبب إلغاء صحيح'},user('admin'))),error('invalid-argument'));
  }
});
test('rules: owner reads own registered order; cross-user and guest reads denied; admin reads all',async()=>{
  const {result}=await makeOrder();
  const a=env.authenticatedContext('alice',{firebase:{sign_in_provider:'google.com'}}).firestore();
  const b=env.authenticatedContext('bob',{firebase:{sign_in_provider:'google.com'}}).firestore();
  const g=env.authenticatedContext('guest',{firebase:{sign_in_provider:'anonymous'}}).firestore();
  const admin=env.authenticatedContext('admin',{firebase:{sign_in_provider:'google.com'}}).firestore();
  await assertSucceeds(getDoc(doc(a,'orders',result.orderId)));await assertFails(getDoc(doc(b,'orders',result.orderId)));
  await assertFails(getDocs(collection(g,'orders')));await assertFails(getDocs(collection(a,'orders')));
  await assertSucceeds(getDocs(query(collection(a,'orders'),where('uid','==','alice'),where('checkoutMode','==','registered'))));
  await assertSucceeds(getDocs(collection(admin,'orders')));
  for(const client of [a,g,admin,env.unauthenticatedContext().firestore()]) await assertFails(setDoc(doc(client,'orders','forged'),{uid:'alice',total:1}));
  await assertFails(updateDoc(doc(admin,'orders',result.orderId),{status:'delivered'}));
});
test('rules: Google profile/address work while financial fields, guest profiles and private collections are protected',async()=>{
  const a=env.authenticatedContext('alice',{firebase:{sign_in_provider:'google.com'}}).firestore();
  const g=env.authenticatedContext('guest',{firebase:{sign_in_provider:'anonymous'}}).firestore();
  const profile={displayName:'عميل اختبار',email:'test@example.invalid',phoneNumber:'',points:0,rewardCredit:0,lifetimeSpend:0,createdAt:serverTimestamp()};
  await assertSucceeds(setDoc(doc(a,'customers','alice'),profile));
  await assertSucceeds(updateDoc(doc(a,'customers','alice'),{shippingGov:'القاهرة',shippingAddress:'عنوان اختبار'}));
  for(const patch of [{points:1},{rewardCredit:10},{lifetimeSpend:10},{email:'x'.repeat(255)},{shippingAddress:'x'.repeat(501)}]) await assertFails(updateDoc(doc(a,'customers','alice'),patch));
  await assertFails(setDoc(doc(g,'customers','guest'),profile));await assertFails(setDoc(doc(a,'customers','bob'),profile));
  for(const path of ['storeSettings/checkout','checkoutQuotes/test','checkoutRateLimits/alice','admins/admin']) await assertFails(getDoc(doc(a,path)));
  await assertFails(setDoc(doc(a,'catalog','TEST-001'),{priceEGP:1}));
});
test('HTTP callable: emulator Google and guest auth, App Check rejection, and trusted checkout round trip',async()=>{
  const authUrl='http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/';
  async function signIn(kind) {
    const endpoint=kind==='guest'?'accounts:signUp':'accounts:signInWithIdp';
    const body=kind==='guest'?{returnSecureToken:true}:{requestUri:'http://localhost',returnSecureToken:true,postBody:new URLSearchParams({providerId:'google.com',id_token:JSON.stringify({sub:'google-emulator-user',email:'emulator@example.invalid',email_verified:true,name:'عميل Google تجريبي'})}).toString()};
    const response=await fetch(authUrl+endpoint+'?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();assert.ok(result.idToken,JSON.stringify(result));return result;
  }
  const token=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:'demo-orka-app',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.';
  async function invoke(name,data,idToken,appCheck=token,port=5001) {
    const headers={'Content-Type':'application/json',Authorization:'Bearer '+idToken};if(appCheck!==null) headers['X-Firebase-AppCheck']=appCheck;
    const response=await fetch('http://127.0.0.1:'+port+'/demo-orka-checkout/me-central1/'+name,{method:'POST',headers,body:JSON.stringify({data})});return response.json();
  }
  const google=await signIn('registered');
  const missing=await invoke('quoteOrkaOrder',input(),google.idToken,null);assert.equal(missing.error?.status,'UNAUTHENTICATED');
  const invalid=await invoke('quoteOrkaOrder',input(),google.idToken,'invalid',5002);assert.equal(invalid.error?.status,'UNAUTHENTICATED',JSON.stringify(invalid));
  const fake=await invoke('quoteOrkaOrder',input(),google.idToken,token,5002);assert.equal(fake.error?.status,'UNAUTHENTICATED',JSON.stringify(fake));
  for(const mode of ['registered','guest']) {
    const auth=mode==='registered'?google:await signIn('guest'),data=input({checkoutMode:mode});
    const quote=await invoke('quoteOrkaOrder',data,auth.idToken);assert.ok(quote.result?.quoteId,JSON.stringify(quote));
    const result=await invoke('createOrkaOrder',{...data,quoteId:quote.result.quoteId},auth.idToken);assert.ok(result.result?.orderId,JSON.stringify(result));
    const replay=await invoke('createOrkaOrder',{...data,quoteId:quote.result.quoteId},auth.idToken);assert.equal(replay.result?.orderId,result.result.orderId);
    const order=(await db.doc('orders/'+result.result.orderId).get()).data();assert.equal(order.uid,auth.localId);assert.equal(order.totalEGP,295);
  }
});
