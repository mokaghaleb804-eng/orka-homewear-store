// ORKA verified admin boundary (review-only, not wired to a public endpoint).
// Firebase Admin Auth verifier must be injected by the trusted server.
// Client-provided uid, role and email are ignored; role comes only from verified token claims.
import {CheckoutError} from './trusted-order-calculator.mjs';
export function createAuthorizedFulfillment({verifyIdToken,changeOrderStatus}){
 if(typeof verifyIdToken!=='function'||typeof changeOrderStatus!=='function')
  throw new CheckoutError('INVALID_DEPENDENCY','Verified auth and service required');
 return async function handle({idToken,orderId,nextStatus}){
  if(typeof idToken!=='string'||!idToken.trim())throw new CheckoutError('AUTH_REQUIRED','Authentication required');
  let identity;
  try{identity=await verifyIdToken(idToken,true);}
  catch{throw new CheckoutError('AUTH_INVALID','Invalid or revoked token');}
  if(!identity||typeof identity.uid!=='string'||identity.admin!==true)
   throw new CheckoutError('FORBIDDEN','Verified admin required');
  return changeOrderStatus({orderId,nextStatus,actorRole:'admin'});
 };
}
