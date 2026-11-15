'use strict';
// Run ONLY against Firestore emulator via firebase emulators:exec.
const assert=require('node:assert/strict');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const fs=require('node:fs');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'orka-club-rules-test',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
 try{
  const alice=env.authenticatedContext('alice').firestore();
  const bob=env.authenticatedContext('bob').firestore();
  const guest=env.unauthenticatedContext().firestore();
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await db.doc('wallets/alice').set({balancePiastres:1000});
   await db.doc('wallets/alice/credits/credit1').set({remaining:1000});
   await db.doc('wallets/alice/events/event1').set({type:'grant'});
   await db.doc('walletOperations/operation1').set({uid:'alice'});
  });
  await assertSucceeds(alice.doc('wallets/alice').get());
  await assertSucceeds(alice.doc('wallets/alice/credits/credit1').get());
  await assertSucceeds(alice.doc('wallets/alice/events/event1').get());
  await assertFails(bob.doc('wallets/alice').get());
  await assertFails(bob.doc('wallets/alice/credits/credit1').get());
  await assertFails(guest.doc('wallets/alice').get());
  await assertFails(alice.doc('wallets/alice').set({balancePiastres:999999}));
  await assertFails(alice.doc('wallets/alice/credits/fake').set({remaining:999999}));
  await assertFails(alice.doc('wallets/alice/events/fake').set({type:'grant'}));
  await assertFails(alice.doc('walletOperations/operation1').get());
  await assertFails(alice.doc('walletOperations/fake').set({uid:'alice'}));
  await assertFails(alice.doc('orders/fake').set({uid:'alice',total:1}));
  console.log('Firestore emulator wallet authorization tests passed (12 checks)');
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exitCode=1});
