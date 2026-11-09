// DRAFT: emulator-only adapter. Not imported by the production storefront.
import {getAuth,signInAnonymously} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-functions.js';
import {checkoutAttempt,saveAttempt} from './attempt-store.mjs';

function localOnly(app) {
  if(app.options.projectId!=='demo-orka-checkout' || app.name!=='orka-emulator-preview') throw Error('هذه النسخة تعمل على المحاكي المحلي فقط');
}
function payload(mode,customer,cart) {
  if(!['registered','guest'].includes(mode) || !Array.isArray(cart) || !cart.length) throw Error('بيانات الطلب غير مكتملة');
  const items=cart.map(i=>({productId:String(i.productId||'').trim(),size:String(i.size||'').trim(),qty:Number(i.qty)})).sort((a,b)=>a.productId.localeCompare(b.productId,'en') || a.size.localeCompare(b.size,'en'));
  if(items.some(i=>!i.productId || !i.size || !Number.isInteger(i.qty) || i.qty<1)) throw Error('اربط الموديلات بالكتالوج أولًا');
  let phone=String(customer.phone||'').replace(/[+() -]/g,'');
  if(phone.startsWith('0020')) phone='0'+phone.slice(4);else if(phone.startsWith('20')) phone='0'+phone.slice(2);
  return {checkoutMode:mode,customer:String(customer.name||'').trim(),phone,gov:String(customer.gov||'').trim(),address:String(customer.address||'').trim(),notes:String(customer.notes||'').trim(),items};
}
async function context(app,mode,customer,cart) {
  localOnly(app);
  const auth=getAuth(app);
  if(mode==='guest' && !auth.currentUser) await signInAnonymously(auth);
  const user=auth.currentUser;
  if(!user || user.isAnonymous!==(mode==='guest')) throw Error('جلسة الشراء لا تطابق الاختيار');
  const input=payload(mode,customer,cart);
  const attempt=await checkoutAttempt(sessionStorage,user.uid,input);
  if(getAuth(app).currentUser?.uid!==user.uid) throw Error('تغير الحساب؛ أعد مراجعة الطلب');
  return {input,attempt,uid:user.uid};
}
export async function quoteOrkaCheckoutOrder(app,mode,customer,cart) {
  const {input,attempt,uid}=await context(app,mode,customer,cart);
  if(attempt.receipt) return {receipt:attempt.receipt};
  if(attempt.quote && (attempt.quote.expiresAtMs>Date.now() || attempt.stage==='submitting')) return attempt.quote;
  const fn=httpsCallable(getFunctions(app,location.origin+'/__functions'),'quoteOrkaOrder');
  const {data:quote}=await fn({...input,requestId:attempt.requestId});
  if(getAuth(app).currentUser?.uid!==uid) throw Error('تغير الحساب؛ أعد مراجعة الطلب');
  if(!quote?.quoteId || !Number.isSafeInteger(quote.totalEGP)) throw Error('تعذر استلام عرض السعر');
  attempt.quote=quote;saveAttempt(sessionStorage,attempt);return quote;
}
export async function createOrkaCheckoutOrder(app,mode,customer,cart,acceptedQuoteId) {
  const {input,attempt,uid}=await context(app,mode,customer,cart);
  if(attempt.receipt) return attempt.receipt;
  if(!attempt.quote || attempt.quote.quoteId!==acceptedQuoteId) throw Error('راجع عرض السعر ووافق عليه أولًا');
  attempt.stage='submitting';saveAttempt(sessionStorage,attempt);
  try {
    const fn=httpsCallable(getFunctions(app,location.origin+'/__functions'),'createOrkaOrder');
    const {data:receipt}=await fn({...input,requestId:attempt.requestId,quoteId:acceptedQuoteId});
    if(!receipt?.orderId || !Number.isSafeInteger(receipt.totalEGP)) throw Error('لم نتأكد من نتيجة الطلب؛ أعد نفس المحاولة');
    attempt.receipt=receipt;attempt.stage='complete';saveAttempt(sessionStorage,attempt);
    if(getAuth(app).currentUser?.uid!==uid) throw Error('تغير الحساب؛ النتيجة محفوظة للحساب السابق');
    return receipt;
  } catch(error) {
    // Only a definite atomic rejection permits a fresh quote; unknown failures retain the key.
    if(['functions/failed-precondition','functions/invalid-argument','functions/resource-exhausted','functions/permission-denied','functions/unauthenticated'].includes(error.code)) {
      attempt.stage='draft';delete attempt.quote;saveAttempt(sessionStorage,attempt);
    }
    throw error;
  }
}
