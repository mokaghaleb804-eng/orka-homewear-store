import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,collection,getDocs,serverTimestamp} from 'firebase/firestore';

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
