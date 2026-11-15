'use strict';
// Real Firestore Emulator integration; no production project or credentials.
const assert=require('node:assert/strict');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
const {createFirestoreWalletGrantService}=require('./orka-club-firestore-grant-service.cjs');
const {createFirestoreWalletRedeemService}=require('./orka-club-firestore-redeem-service.cjs');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('FIRESTORE_EMULATOR_HOST required; refusing live Firestore');
const app=initializeApp({projectId:'orka-club-rules-test'});
const db=getFirestore(app);
(async()=>{
 const orderId='delivery-test';
 await db.doc('orders/'+orderId).set({
  uid:'alice',status:'delivered',deliveryVerifiedByServer:true,
  eligibleSubtotalPiastres:100000,deliveredAt:Timestamp.fromDate(new Date('2026-11-01T00:00:00Z')),
  fullPrice:true,usedWallet:false
 });
 const grant=createFirestoreWalletGrantService(db);
 const grants=await Promise.all(Array.from({length:8},()=>grant.grantDeliveredOrder(orderId)));
 assert.equal(grants.filter(g=>!g.duplicate).length,1);
 assert.ok(grants.every(g=>g.amountPiastres===10000));
 await db.doc('orders/'+orderId).update({eligibleSubtotalPiastres:200000});
 await assert.rejects(grant.grantDeliveredOrder(orderId),/Delivery replay conflict/);
 await db.doc('orders/'+orderId).update({eligibleSubtotalPiastres:100000});
 const redeem=createFirestoreWalletRedeemService(db);
 const mk=id=>redeem.redeemTrustedUnit({
  uid:'alice',operationId:id,orderId:'checkout-'+id,unitId:'unit1',
  unitPricePiastres:8000,now:'2026-11-15T00:00:00Z'
 });
 const [a,b]=await Promise.all([mk('first'),mk('second')]);
 assert.equal(a.discountPiastres+b.discountPiastres,10000);
 const credit=await db.doc('wallets/alice/credits/grant_'+orderId).get();
 assert.equal(credit.data().remaining,0);
 assert.deepEqual(await mk('first'),a);
 await assert.rejects(redeem.redeemTrustedUnit({
  uid:'alice',operationId:'first',orderId:'checkout-first',unitId:'unit1',
  unitPricePiastres:9000,now:'2026-11-15T00:00:00Z'
 }),/Idempotency conflict/);
 console.log('Firestore emulator transactional grant, concurrent redeem, and replay tests passed');
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exitCode=1;setTimeout(()=>process.exit(1),100)});
