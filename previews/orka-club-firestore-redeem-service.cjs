'use strict';
// SERVER-ONLY preview: caller must authenticate UID and verify the server-priced
// order/unit before invoking. Not an HTTP endpoint or deployed checkout.
const {redeem}=require('./orka-club-wallet-engine.cjs');
function validId(x){return typeof x==='string'&&x.length>0&&!x.includes('/')}
function createFirestoreWalletRedeemService(db){
 if(!db||typeof db.runTransaction!=='function')throw Error('Admin Firestore required');
 return {async redeemTrustedUnit({uid,operationId,orderId,unitId,unitPricePiastres,now}){
  if(![uid,operationId,orderId,unitId].every(validId)||!Number.isSafeInteger(unitPricePiastres)||unitPricePiastres<0||!Number.isFinite(Date.parse(now)))throw Error('Invalid trusted redemption');
  // Trusted caller must enforce one eligible unit, non-stacking and price snapshot.
  const signature=JSON.stringify({uid,orderId,unitId,unitPricePiastres});
  return db.runTransaction(async tx=>{
   const opRef=db.doc('walletOperations/redeem_'+operationId);
   const orderRef=db.doc('orders/'+orderId);
   const [prior,orderSnap]=await Promise.all([tx.get(opRef),tx.get(orderRef)]);
   if(!orderSnap.exists)throw Error('Trusted checkout order missing');
   const order=orderSnap.data();
   const unit=order.walletRedemptionUnit;
   if(order.uid!==uid||order.checkoutValidatedByServer!==true||order.status!=='pending'||order.usedWallet!==false||order.fullPrice!==true||!unit||unit.id!==unitId||unit.pricePiastres!==unitPricePiastres)throw Error('Untrusted checkout or price');
   if(prior.exists){const p=prior.data();if(p.signature!==signature)throw Error('Idempotency conflict');return p.result}
   const q=db.collection('wallets').doc(uid).collection('credits');
   const snapshot=await tx.get(q);
   const credits=snapshot.docs.map(d=>({id:d.id,remaining:d.data().remaining,expiresAt:d.data().expiresAt}));
   const result=redeem({credits,pricePiastres:unitPricePiastres,now});
   // Every read above occurs before any transaction write.
   for(const debit of result.debits){
    const doc=snapshot.docs.find(d=>d.id===debit.creditId);
    tx.update(doc.ref,{remaining:result.credits.find(c=>c.id===debit.creditId).remaining});
   }
   const response={orderId,unitId,discountPiastres:result.discount,duePiastres:result.due,debits:result.debits};
   tx.create(opRef,{uid,signature,type:'redeem',result:response});
   return response;
  });
 }};
}
module.exports={createFirestoreWalletRedeemService};
