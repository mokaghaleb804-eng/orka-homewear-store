// ORKA isolated order service — dependency-injected prototype, NO Firebase or network calls.
// Storage adapter must implement atomic createOnce(scope,key,buildRecord), not a read-then-write.
// Production requires authenticated server identity, trusted catalog, rate limiting and audit logs.
import {calculateTrustedOrder,CheckoutError} from './trusted-order-calculator.mjs';
const requestKeyPattern=/^[A-Za-z0-9_-]{16,128}$/;
export async function submitTrustedOrder({uid,requestKey,checkout,catalog,store,clock=()=>new Date().toISOString()}){
 if(typeof uid!=='string'||!uid.trim())throw new CheckoutError('AUTH_REQUIRED','Sign in required');
 if(typeof requestKey!=='string'||!requestKeyPattern.test(requestKey))throw new CheckoutError('INVALID_REQUEST_KEY','Invalid idempotency key');
 if(!store||typeof store.createOnce!=='function')throw new CheckoutError('STORE_REQUIRED','Atomic store required');
 const order=calculateTrustedOrder({authUid:uid,checkout,catalog});
 const fingerprint=JSON.stringify({uid,checkout:order.items.map(x=>[x.productId,x.size,x.quantity]),shippingPhone:order.shippingPhone,gov:order.gov,address:order.address,subtotalCents:order.subtotalCents});
 return store.createOnce(uid,requestKey,()=>({
  ...order,
  requestKey,
  fingerprint,
  createdAt:clock()
 }),fingerprint);
}
// Disposable test double only. Never use in production; process restarts erase it.
export function createMemoryOrderStore(){
 const records=new Map();let seq=0;
 return {
  async createOnce(uid,key,makeRecord,fingerprint){
   const scoped=JSON.stringify([uid,key]);
   if(records.has(scoped)){
    const prior=records.get(scoped);
    if(prior.fingerprint!==fingerprint)throw new CheckoutError('KEY_REUSED','Request key reused for different order');
    return {orderId:prior.orderId,created:false,order:structuredClone(prior)};
   }
   const record={...makeRecord(),orderId:'test-order-'+(++seq)};
   records.set(scoped,record);
   return {orderId:record.orderId,created:true,order:structuredClone(record)};
  },
  count:()=>records.size
 };
}
