'use strict';
// Server-only checkout adapter prototype. Never call with browser-supplied UID,
// catalog, shipping or order status. Not an HTTP endpoint; no live deployment.
const {buildTrustedCheckout,selectWalletUnit}=require('./orka-club-trusted-checkout-contract.cjs');
function validId(s){return typeof s==='string'&&s.length>0&&s.length<=256&&s!=='.'&&s!=='..'&&!s.includes('/')&&!s.includes('\\')&&!/[\u0000-\u001f]/.test(s)}
function createFirestoreTrustedCheckoutService(db,{verifyIdentity,resolveShipping}={}){
 if(!db||typeof db.runTransaction!=='function'||typeof verifyIdentity!=='function'||typeof resolveShipping!=='function')throw Error('Trusted backend dependencies required');
 return {async createCheckout({identityToken,orderId,items,shippingAddress,walletUnitId}){
  // Authentication must be independently verified by a privileged backend.
  const identity=await verifyIdentity(identityToken);
  if(!identity||!validId(identity.uid)||!validId(orderId)||!Array.isArray(items)||!items.length||items.length>50)throw Error('Invalid authenticated checkout');
  const requested=items.map(i=>({unitId:i?.unitId,productId:i?.productId}));
  if(requested.some(i=>!validId(i.unitId)||!validId(i.productId)))throw Error('Invalid checkout item');
  const signature=JSON.stringify({uid:identity.uid,items:requested,shippingAddress:shippingAddress??null,walletUnitId:walletUnitId??null});
  return db.runTransaction(async tx=>{
   const orderRef=db.doc('orders/'+orderId);
   const existing=await tx.get(orderRef);
   if(existing.exists){
    const prior=existing.data();
    if(prior.checkoutRequestSignature!==signature||prior.uid!==identity.uid)throw Error('Checkout idempotency conflict');
    return {duplicate:true,order:prior};
   }
   const shippingPiastres=await resolveShipping({uid:identity.uid,address:shippingAddress,items:requested,transaction:tx});
   if(!Number.isSafeInteger(shippingPiastres)||shippingPiastres<0)throw Error('Invalid server shipping');
   const productIds=[...new Set(requested.map(i=>i.productId))];
   const refs=productIds.map(id=>db.doc('catalog/'+id));
   const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
   const catalog=Object.create(null);
   for(let i=0;i<productIds.length;i++){
    if(!snapshots[i].exists)throw Error('Catalog product missing');
    catalog[productIds[i]]=snapshots[i].data();
   }
   let order=buildTrustedCheckout({authenticatedUid:identity.uid,orderId,items:requested,catalog,shippingPiastres});
   if(walletUnitId!==undefined&&walletUnitId!==null)order=selectWalletUnit(order,walletUnitId);
   order.checkoutRequestSignature=signature;
   tx.create(orderRef,order);
   return {duplicate:false,order};
  });
 }};
}
module.exports={createFirestoreTrustedCheckoutService};
