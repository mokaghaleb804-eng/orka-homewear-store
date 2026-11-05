// ORKA atomic fulfillment adapter (review-only). No live Firebase connection.
// db must be an authenticated server-side Firestore Admin SDK instance.
// Only a trusted server may pass actorRole; never accept it from the browser.
import {transitionOrder} from './order-fulfillment.mjs';
import {CheckoutError} from './trusted-order-calculator.mjs';
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
export function createFulfillmentService(db,{serverNow=()=>new Date().toISOString()}={}){
 if(!db||typeof db.runTransaction!=='function'||typeof db.collection!=='function')
  throw new CheckoutError('INVALID_STORE','Admin Firestore instance required');
 return async function changeOrderStatus({orderId,nextStatus,actorRole}){
  if(!validId(orderId))throw new CheckoutError('INVALID_ORDER_ID','Invalid order ID');
  if(actorRole!=='admin')throw new CheckoutError('FORBIDDEN','Admin required');
  const ref=db.collection('orders').doc(orderId);
  return db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)throw new CheckoutError('ORDER_NOT_FOUND','Order not found');
   const old=snap.data();
   // State transition and write are in one transaction, so concurrent admin
   // requests cannot both advance the same original state.
   const updated=transitionOrder(old,nextStatus,{actorRole,at:serverNow()});
   tx.update(ref,{status:updated.status,statusUpdatedAt:updated.statusUpdatedAt,
    ...(updated.deliveredAt?{deliveredAt:updated.deliveredAt}:{}),
    ...(updated.cancelledAt?{cancelledAt:updated.cancelledAt}:{}),
    ...(updated.returnedAt?{returnedAt:updated.returnedAt}:{})});
   // Intentionally do not credit loyalty here. This requires separately
   // approved rules, reversal policy and an idempotent reward ledger.
   return {orderId,status:updated.status,loyaltyCredited:false};
  });
 };
}
