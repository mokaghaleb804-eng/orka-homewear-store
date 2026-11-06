import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,collection,getDocs,query,where,serverTimestamp} from 'firebase/firestore';

const projectId='demo-orka-security';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!host)throw Error('FIRESTORE_EMULATOR_HOST is required; never use production Firebase');
const [emulatorHost,portText]=host.split(':');
const env=await initializeTestEnvironment({
 projectId,
 firestore:{host:emulatorHost,port:Number(portText),rules:fs.readFileSync('tests/firestore.rules.proposed','utf8')}
});
after(async()=>{await env.cleanup()});
 await env.withSecurityRulesDisabled(async ctx=>{
  await setDoc(doc(ctx.firestore(),'admins','admin1'),{role:'admin'});
  await setDoc(doc(ctx.firestore(),'orders','order1'),{uid:'user1',status:'pending',payableCents:85000});
 });
 const user=env.authenticatedContext('user1',{email:'test@example.com'});
 const other=env.authenticatedContext('user2',{email:'other@example.com'});
 const admin=env.authenticatedContext('admin1');
 const guest=env.unauthenticatedContext();
 test('Google login without phone claim creates own basic profile',async()=>{
  await assertSucceeds(setDoc(doc(user.firestore(),'customers','user1'),{
   displayName:'Test Customer',email:'test@example.com',createdAt:serverTimestamp()
  }));
  await assertSucceeds(getDoc(doc(user.firestore(),'customers','user1')));
 });
 test('unauthenticated or another user cannot create/read profile',async()=>{
  await assertFails(setDoc(doc(guest.firestore(),'customers','guest'),{displayName:'Guest',createdAt:serverTimestamp()}));
  await assertFails(getDoc(doc(other.firestore(),'customers','user1')));
 });
 test('spoofed phone and loyalty fields are rejected',async()=>{
  await assertFails(setDoc(doc(other.firestore(),'customers','user2'),{
   displayName:'Another User',phoneNumber:'+201012345678',createdAt:serverTimestamp()
  }));
  await assertFails(setDoc(doc(other.firestore(),'customers','user2'),{
   displayName:'Another User',points:999,createdAt:serverTimestamp()
  }));
 });
 test('customer can edit shipping but not points',async()=>{
  await assertSucceeds(updateDoc(doc(user.firestore(),'customers','user1'),{shippingGov:'Giza',shippingAddress:'Example street 12'}));
  await assertFails(updateDoc(doc(user.firestore(),'customers','user1'),{points:999}));
 });
 test('customer cannot read another order, admin can',async()=>{
  await assertFails(getDoc(doc(other.firestore(),'orders','order1')));
  await assertSucceeds(getDoc(doc(admin.firestore(),'orders','order1')));
 });
 test('all client order creates and updates are denied',async()=>{
  await assertFails(setDoc(doc(user.firestore(),'orders','client-order'),{uid:'user1',status:'pending',payableCents:1}));
  await assertFails(updateDoc(doc(admin.firestore(),'orders','order1'),{status:'delivered'}));
 });
 test('client cannot create admin role',async()=>{
  await assertFails(setDoc(doc(user.firestore(),'admins','user1'),{role:'admin'}));
 });

test('anonymous guest cannot list orders or customers',async()=>{
 await assertFails(getDocs(collection(guest.firestore(),'orders')));
 await assertFails(getDocs(collection(guest.firestore(),'customers')));
});
test('ordinary customer cannot list all orders or customers',async()=>{
 await assertFails(getDocs(collection(user.firestore(),'orders')));
 await assertFails(getDocs(collection(user.firestore(),'customers')));
});
test('ordinary customer cannot change an existing order status',async()=>{
 await assertFails(updateDoc(doc(user.firestore(),'orders','order1'),{status:'delivered'}));
});
test('non-admin cannot read admin role records',async()=>{
 await assertFails(getDoc(doc(user.firestore(),'admins','admin1')));
});

test('customer can list only own orders with an ownership filter',async()=>{
 const result=await assertSucceeds(getDocs(query(collection(user.firestore(),'orders'),where('uid','==','user1'))));
 assert.equal(result.size,1);
 assert.equal(result.docs[0].id,'order1');
});
test('customer cannot query another customer orders even with an explicit filter',async()=>{
 await assertFails(getDocs(query(collection(other.firestore(),'orders'),where('uid','==','user1'))));
});
test('verified admin can list orders but not change them from the browser',async()=>{
 const result=await assertSucceeds(getDocs(collection(admin.firestore(),'orders')));
 assert.equal(result.size,1);
 await assertFails(updateDoc(doc(admin.firestore(),'orders','order1'),{status:'cancelled'}));
});
test('verified admin can list customer profiles while non-admin cannot',async()=>{
 const result=await assertSucceeds(getDocs(collection(admin.firestore(),'customers')));
 assert.ok(result.size>=1);
 await assertFails(getDocs(collection(other.firestore(),'customers')));
});
