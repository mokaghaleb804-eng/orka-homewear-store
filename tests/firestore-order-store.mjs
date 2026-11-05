// ORKA Firestore adapter — server-only dependency injection; NOT deployed.
// Requires an authenticated trusted server and Firebase Admin SDK injected as db.
// Document IDs are scoped to authenticated UID + client-generated request key.
// A Firestore transaction atomically creates the record only once.
// NOTE: Use with server-side authorization, catalog and abuse protections.
import {CheckoutError} from './trusted-order-calculator.mjs';
export function createFirestoreOrderStore(db){
 if(!db||typeof db.runTransaction!=='function'||typeof db.collection!=='function')
  throw new CheckoutError('INVALID_STORE','Firestore Admin db required');
 return {
  async createOnce(uid,key,makeRecord,fingerprint){
   const ref=db.collection('orderRequests').doc(uid).collection('keys').doc(key);
   return db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(snap.exists){
     const existing=snap.data();
     if(existing.fingerprint!==fingerprint)
      throw new CheckoutError('KEY_REUSED','Request key already used for another order');
     return {orderId:existing.orderId,created:false,order:existing.order};
    }
    // The order ID is allocated server-side. Client cannot choose it.
    const orderRef=db.collection('orders').doc();
    const order={...makeRecord(),orderId:orderRef.id};
    tx.create(orderRef,order);
    tx.create(ref,{orderId:orderRef.id,fingerprint,order,createdAt:order.createdAt});
    return {orderId:orderRef.id,created:true,order};
   });
  }
 };
}
