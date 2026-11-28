// Browser session contains public quote data and a hash, never contact details.
export const attemptKey=uid=>'orka.checkout.attempt.v1.'+uid;
export async function inputHash(input) {
  const bytes=new TextEncoder().encode(JSON.stringify(input));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function checkoutAttempt(storage,uid,input) {
  const key=attemptKey(uid),hash=await inputHash(input);
  let saved;
  const raw=storage.getItem(key);
  try { saved=raw?JSON.parse(raw):null; } catch { throw Error('بيانات المحاولة غير سليمة؛ لا تبدأ طلبًا آخر قبل مراجعتها'); }
  if(saved && (saved.version!==1 || saved.uid!==uid || !saved.requestId || !saved.inputHash)) throw Error('بيانات المحاولة غير سليمة');
  if(saved?.inputHash===hash) return saved;
  if(saved?.stage==='submitting') throw Error('هناك طلب لم تتأكد نتيجته؛ أعد المحاولة بنفس بياناته قبل تعديل السلة');
  const value={version:1,uid,inputHash:hash,requestId:crypto.randomUUID(),stage:'draft'};
  storage.setItem(key,JSON.stringify(value));
  return value;
}
export function saveAttempt(storage,attempt) {
  storage.setItem(attemptKey(attempt.uid),JSON.stringify(attempt));
}
