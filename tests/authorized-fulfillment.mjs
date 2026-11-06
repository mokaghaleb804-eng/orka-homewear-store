// ORKA verified admin boundary (review-only, not wired to a public endpoint).
// Firebase Admin Auth verifier must be injected by the trusted server.
// Client-provided uid, role and email are ignored; role comes from a server-read admin record for the verified UID.
import {CheckoutError} from './trusted-order-calculator.mjs';
export function createAuthorizedFulfillment({verifyIdToken,hasAdminRole,changeOrderStatus}){
 if(typeof verifyIdToken!=='function'||typeof hasAdminRole!=='function'||typeof changeOrderStatus!=='function')
  throw new CheckoutError('INVALID_DEPENDENCY','Verified auth and service required');
 return async function handle({idToken,orderId,nextStatus}){
  if(typeof idToken!=='string'||!idToken.trim())throw new CheckoutError('AUTH_REQUIRED','Authentication required');
  let identity;
  try{identity=await verifyIdToken(idToken,true);}
  catch{throw new CheckoutError('AUTH_INVALID','Invalid or revoked token');}
  if(!identity||typeof identity.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(identity.uid))throw new CheckoutError('AUTH_INVALID','Invalid identity');
  if(await hasAdminRole(identity.uid)!==true)
   throw new CheckoutError('FORBIDDEN','Verified admin required');
  return changeOrderStatus({orderId,nextStatus,actorRole:'admin'});
 };
}
