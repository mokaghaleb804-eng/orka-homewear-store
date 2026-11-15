'use strict';
// SERVER-ONLY Firestore transaction adapter prototype.
// Requires a Firestore Admin SDK db injected by a privileged backend.
// Not an HTTP endpoint, not deployed, and not safe to expose directly to clients.
const {earn,grant}=require('./orka-club-wallet-engine.cjs');
function requireId(s,label){if(typeof s!=='string'||!s.trim()||s.includes('/'))throw Error('Invalid '+label)}
function createFirestoreWalletGrantService(db){
 if(!db||typeof db.runTransaction!=='function')throw Error('Firestore Admin database required');
 return {
  async grantDeliveredOrder(orderId){
   requireId(orderId,'order ID');
   return db.runTransaction(async tx=>{
    const orderRef=db.doc('orders/'+orderId);
    const orderSnap=await tx.get(orderRef);
    if(!orderSnap.exists)throw Error('Order not found');
    const o=orderSnap.data();
    // Never use client-submitted owner, amount, delivery state, or timestamps.
    if(o.status!=='delivered'||o.deliveryVerifiedByServer!==true)throw Error('Delivery not verified by server');
    const uid=o.uid;
    requireId(uid,'owner UID');
    if(!Number.isSafeInteger(o.eligibleSubtotalPiastres)||o.eligibleSubtotalPiastres<0)throw Error('Untrusted or missing server subtotal');
    if(typeof o.deliveredAt?.toDate!=='function')throw Error('Trusted delivery timestamp required');
    const opRef=db.doc('walletOperations/grant_'+orderId);
    const creditRef=db.doc('wallets/'+uid+'/credits/grant_'+orderId);
    const opSnap=await tx.get(opRef);
    if(opSnap.exists){
     const prior=opSnap.data();
     if(prior.uid!==uid)throw Error('Grant ownership conflict');
     return {duplicate:true,amountPiastres:prior.amountPiastres};
    }
    const amount=o.usedWallet===true||o.fullPrice!==true?0:earn(o.eligibleSubtotalPiastres);
    const deliveredAt=o.deliveredAt.toDate().toISOString();
    if(amount){
     const credit=grant({id:'grant_'+orderId,amount,issuedAt:deliveredAt});
     tx.create(creditRef,{orderId,originalAmount:amount,remaining:amount,issuedAt:credit.issuedAt,expiresAt:credit.expiresAt,revokedPiastres:0,recoveryExposurePiastres:0});
    }
    tx.create(opRef,{uid,orderId,type:'grant',amountPiastres:amount,deliveryVersion:o.deliveryVersion||null});
    return {duplicate:false,amountPiastres:amount};
   });
  }
 };
}
module.exports={createFirestoreWalletGrantService};
