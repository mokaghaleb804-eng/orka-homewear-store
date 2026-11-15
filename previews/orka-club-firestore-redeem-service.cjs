'use strict';
// SERVER-ONLY preview: caller must authenticate UID and verify the server-priced
// order/unit before invoking. Not an HTTP endpoint or deployed checkout.
const {redeem}=require('./orka-club-wallet-engine.cjs');
function validId(x){return typeof x==='string'&&x.length>0&&!x.includes('/')}
function createFirestoreWalletRedeemService(db,{clock=()=>new Date()}={}){
 if(!db||typeof db.runTransaction!=='function'||typeof clock!=='function')throw Error('Admin Firestore and server clock required');
 return {async redeemTrustedUnit({uid,operationId,orderId,unitId,unitPricePiastres}){
  if(![uid,operationId,orderId,unitId].every(validId)||!Number.isSafeInteger(unitPricePiastres)||unitPricePiastres<0)throw Error('Invalid trusted redemption');
  // Trusted caller must enforce one eligible unit, non-stacking and price snapshot.
  const signature=JSON.stringify({uid,orderId,unitId,unitPricePiastres});
  return db.runTransaction(async tx=>{
   const opRef=db.doc('walletOperations/redeem_'+operationId);
   const orderRef=db.doc('orders/'+orderId);
   const [prior,orderSnap]=await Promise.all([tx.get(opRef),tx.get(orderRef)]);
   if(!orderSnap.exists)throw Error('Trusted checkout order missing');
   const order=orderSnap.data();
   const unit=order.walletRedemptionUnit;
   if(order.uid!==uid||order.checkoutValidatedByServer!==true||order.status!=='pending'||order.fullPrice!==true||!unit||unit.id!==unitId||unit.pricePiastres!==unitPricePiastres||!Array.isArray(order.units)||order.units.filter(u=>u&&u.id===unitId&&u.pricePiastres===unitPricePiastres).length!==1)throw Error('Untrusted checkout or price');
   const seenUnits=new Set();let computedSubtotal=0;
   for(const item of order.units){
    if(!item||!validId(item.id)||seenUnits.has(item.id)||!Number.isSafeInteger(item.pricePiastres)||item.pricePiastres<0)throw Error('Invalid trusted order units');
    seenUnits.add(item.id);computedSubtotal+=item.pricePiastres;
    if(!Number.isSafeInteger(computedSubtotal))throw Error('Trusted order subtotal overflow');
   }
   if(computedSubtotal!==order.eligibleSubtotalPiastres)throw Error('Trusted unit subtotal mismatch');
   if(prior.exists){const p=prior.data();if(p.signature!==signature)throw Error('Idempotency conflict');if(order.walletRedemptionOperationId!==operationId)throw Error('Order redemption conflict');return p.result}
   if(order.usedWallet!==false||order.walletRedemptionOperationId)throw Error('Order already redeemed');
   const q=db.collection('wallets').doc(uid).collection('credits');
   const snapshot=await tx.get(q);
   const credits=snapshot.docs.map(d=>({id:d.id,remaining:d.data().remaining,expiresAt:d.data().expiresAt}));
   const serverNow=clock();
   if(!(serverNow instanceof Date)||!Number.isFinite(serverNow.getTime()))throw Error('Invalid server clock');
   const result=redeem({credits,pricePiastres:unitPricePiastres,now:serverNow.toISOString()});
   if(result.discount===0)throw Error('No eligible wallet credit');
   if(!Number.isSafeInteger(order.totalPiastres)||!Number.isSafeInteger(order.shippingPiastres)||!Number.isSafeInteger(order.eligibleSubtotalPiastres)||order.shippingPiastres<0||order.eligibleSubtotalPiastres<unitPricePiastres||order.totalPiastres!==order.eligibleSubtotalPiastres+order.shippingPiastres||result.discount>unitPricePiastres)throw Error('Invalid trusted order totals');
   const payablePiastres=order.totalPiastres-result.discount;
   if(!Number.isSafeInteger(payablePiastres)||payablePiastres<order.shippingPiastres)throw Error('Invalid wallet payable total');
   // Every read above occurs before any transaction write.
   for(const debit of result.debits){
    const doc=snapshot.docs.find(d=>d.id===debit.creditId);
    tx.update(doc.ref,{remaining:result.credits.find(c=>c.id===debit.creditId).remaining});
   }
   const response={orderId,unitId,discountPiastres:result.discount,duePiastres:result.due,payablePiastres,debits:result.debits};
   tx.update(orderRef,{usedWallet:true,walletRedemptionOperationId:operationId,walletDiscountPiastres:result.discount,payablePiastres});
   tx.create(opRef,{uid,signature,type:'redeem',result:response});
   return response;
  });
 }};
}
module.exports={createFirestoreWalletRedeemService};
