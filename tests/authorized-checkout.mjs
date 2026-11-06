// ORKA authenticated order submission boundary — prototype only, no public endpoint.
// verifyIdToken must be Firebase Admin Auth verifyIdToken(token, true).
// Catalog must be loaded server-side, never passed from the browser.
import {CheckoutError} from './trusted-order-calculator.mjs';
import {submitTrustedOrder} from './order-service.mjs';
export function createAuthorizedCheckout({verifyIdToken,loadCatalog,store,clock}){
 if(typeof verifyIdToken!=='function'||typeof loadCatalog!=='function'||!store)
  throw new CheckoutError('INVALID_DEPENDENCY','Trusted dependencies required');
 return async function submit({idToken,requestKey,checkout}){
  if(typeof idToken!=='string'||!idToken.trim())throw new CheckoutError('AUTH_REQUIRED','Sign in required');
  let identity;
  try{identity=await verifyIdToken(idToken,true);}
  catch{throw new CheckoutError('AUTH_INVALID','Invalid or revoked sign-in token');}
  if(!identity||typeof identity.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(identity.uid))
   throw new CheckoutError('AUTH_INVALID','Invalid verified identity');
  const catalog=await loadCatalog();
  return submitTrustedOrder({uid:identity.uid,requestKey,checkout,catalog,store,clock});
 };
}
