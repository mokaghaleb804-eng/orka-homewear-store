'use strict';
// Real Firestore Emulator integration; no production project or credentials.
const assert=require('node:assert/strict');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
const {createFirestoreWalletGrantService}=require('./orka-club-firestore-grant-service.cjs');
const {createFirestoreWalletRedeemService}=require('./orka-club-firestore-redeem-service.cjs');
const {createFirestoreWalletReturnService}=require('./orka-club-firestore-return-service.cjs');
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
 const redeem=createFirestoreWalletRedeemService(db,{clock:()=>new Date('2026-11-15T00:00:00Z')});
 const mk=id=>redeem.redeemTrustedUnit({
  uid:'alice',operationId:id,orderId:'checkout-'+id,unitId:'unit1',
  unitPricePiastres:8000
 });
 for(const id of ['first','second'])await db.doc('orders/checkout-'+id).set({uid:'alice',status:'pending',checkoutValidatedByServer:true,usedWallet:false,fullPrice:true,walletRedemptionUnit:{id:'unit1',pricePiastres:8000}});
 const [a,b]=await Promise.all([mk('first'),mk('second')]);
 assert.equal(a.discountPiastres+b.discountPiastres,10000);
 const credit=await db.doc('wallets/alice/credits/grant_'+orderId).get();
 assert.equal(credit.data().remaining,0);
 assert.deepEqual(await mk('first'),a);
 await assert.rejects(redeem.redeemTrustedUnit({uid:'alice',operationId:'third',orderId:'checkout-first',unitId:'unit1',unitPricePiastres:8000}),/Order already redeemed/);
 await db.doc('orders/checkout-first').update({'walletRedemptionUnit.pricePiastres':9000});
 await assert.rejects(mk('first'),/Untrusted checkout or price/);
 await db.doc('orders/checkout-first').update({'walletRedemptionUnit.pricePiastres':8000});
 await assert.rejects(redeem.redeemTrustedUnit({
  uid:'alice',operationId:'first',orderId:'checkout-first',unitId:'unit1',
  unitPricePiastres:9000
 }),/Untrusted checkout or price/);
 const returns=createFirestoreWalletReturnService(db);
 await db.doc('verifiedWalletReturns/return-half').set({verifiedByServer:true,uid:'alice',orderId,cumulativeReturnedEligiblePiastres:50000});
 const half=await returns.reconcileVerifiedReturn({orderId,returnId:'return-half'});
 assert.equal(half.revokedPiastres,0);
 assert.equal(half.newExposurePiastres,5000);
 assert.deepEqual(await returns.reconcileVerifiedReturn({orderId,returnId:'return-half'}),half);
 await db.doc('verifiedWalletReturns/return-half').update({cumulativeReturnedEligiblePiastres:70000});
 await assert.rejects(returns.reconcileVerifiedReturn({orderId,returnId:'return-half'}),/Return replay conflict/);
 await db.doc('verifiedWalletReturns/return-full').set({verifiedByServer:true,uid:'alice',orderId,cumulativeReturnedEligiblePiastres:100000});
 await db.doc('verifiedWalletReturns/return-spoofed').set({verifiedByServer:true,uid:'mallory',orderId,cumulativeReturnedEligiblePiastres:75000});
 await assert.rejects(returns.reconcileVerifiedReturn({orderId,returnId:'return-spoofed'}),/Unverified return/);
 await db.doc('verifiedWalletReturns/return-unverified').set({verifiedByServer:false,uid:'alice',orderId,cumulativeReturnedEligiblePiastres:75000});
 await assert.rejects(returns.reconcileVerifiedReturn({orderId,returnId:'return-unverified'}),/Unverified return/);
 await db.doc('verifiedWalletReturns/return-decreased').set({verifiedByServer:true,uid:'alice',orderId,cumulativeReturnedEligiblePiastres:25000});
 await assert.rejects(returns.reconcileVerifiedReturn({orderId,returnId:'return-decreased'}),/Non-monotonic return/);
 const full=await returns.reconcileVerifiedReturn({orderId,returnId:'return-full'});
 assert.equal(full.totalExposurePiastres,10000);
 const finalCredit=await db.doc('wallets/alice/credits/grant_'+orderId).get();
 assert.equal(finalCredit.data().remaining,0);
 assert.equal(finalCredit.data().recoveryExposurePiastres,10000);
 console.log('Firestore emulator grant, concurrent redeem, replay and return reconciliation tests passed');
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exitCode=1;setTimeout(()=>process.exit(1),100)});
