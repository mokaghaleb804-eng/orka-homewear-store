'use strict';
// SERVER-ONLY preview. Return records must be created by a trusted fulfillment service.
// No public endpoint and no live Firebase writes.
const {reconcileGrantReturn}=require('./orka-club-wallet-refunds-preview.cjs');
function id(s){return typeof s==='string'&&s.length>0&&!s.includes('/')}
function createFirestoreWalletReturnService(db){
 if(!db||typeof db.runTransaction!=='function')throw Error('Admin Firestore required');
 return {async reconcileVerifiedReturn({orderId,returnId}){
  if(!id(orderId)||!id(returnId))throw Error('Invalid identifiers');
  return db.runTransaction(async tx=>{
   const orderRef=db.doc('orders/'+orderId),returnRef=db.doc('verifiedWalletReturns/'+returnId);
   const [orderSnap,returnSnap]=await Promise.all([tx.get(orderRef),tx.get(returnRef)]);
   if(!orderSnap.exists||!returnSnap.exists)throw Error('Trusted return/order not found');
   const o=orderSnap.data(),r=returnSnap.data();
   if(r.verifiedByServer!==true||r.orderId!==orderId||!id(o.uid)||r.uid!==o.uid)throw Error('Unverified return');
   if(!Number.isSafeInteger(o.eligibleSubtotalPiastres)||o.eligibleSubtotalPiastres<=0)throw Error('Invalid original subtotal');
   if(!Number.isSafeInteger(r.cumulativeReturnedEligiblePiastres)||r.cumulativeReturnedEligiblePiastres<0)throw Error('Invalid returned subtotal');
   const opRef=db.doc('walletOperations/return_'+returnId);
   const creditRef=db.doc('wallets/'+o.uid+'/credits/grant_'+orderId);
   const [opSnap,creditSnap]=await Promise.all([tx.get(opRef),tx.get(creditRef)]);
   const signature=JSON.stringify({orderId,uid:o.uid,cumulativeReturnedEligiblePiastres:r.cumulativeReturnedEligiblePiastres,originalEligiblePiastres:o.eligibleSubtotalPiastres});
   if(opSnap.exists){
    const p=opSnap.data();
    if(p.signature!==signature)throw Error('Return replay conflict');
    return p.result;
   }
   if(!creditSnap.exists)throw Error('Grant not found; manual review required');
   const current={id:creditSnap.id,...creditSnap.data()};
   const result=reconcileGrantReturn({credits:[current],grantId:creditSnap.id,returnedEligiblePiastres:r.cumulativeReturnedEligiblePiastres,originalEligiblePiastres:o.eligibleSubtotalPiastres});
   const updated=result.credits[0];
   tx.update(creditRef,{remaining:updated.remaining,revokedPiastres:updated.revokedPiastres,recoveryExposurePiastres:updated.recoveryExposurePiastres,returnedEligiblePiastres:updated.returnedEligiblePiastres});
   const response={orderId,returnId,revokedPiastres:result.revokedPiastres,newExposurePiastres:result.newExposurePiastres,totalExposurePiastres:result.totalExposurePiastres};
   tx.create(opRef,{type:'return',uid:o.uid,signature,result:response});
   return response;
  });
 }};
}
module.exports={createFirestoreWalletReturnService};
