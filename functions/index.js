// DRAFT ONLY — Firebase callable Cloud Function, not deployed.
// Requires firebase-functions v2, firebase-admin, Node 20+.
// Both Google users and guest users (Firebase Anonymous Auth) have auth.uid.
// Guest sign-in must be performed transparently in the storefront, after consent.
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const crypto = require("node:crypto");
initializeApp();
const db = getFirestore();
const REGIONS = ["القاهرة","الجيزة","الإسكندرية","القليوبية","الشرقية","الغربية","المنوفية","الدقهلية","البحيرة","كفر الشيخ","دمياط","بورسعيد","الإسماعيلية","السويس","الفيوم","بني سويف","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","البحر الأحمر","الوادي الجديد","مطروح","شمال سيناء","جنوب سيناء"];
function stringField(v, min, max) {
  return typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
}
function reject(message) { throw new HttpsError("invalid-argument", message); }
function normalizePhone(v) {
  const digits = String(v || "").replace(/\D/g, "");
  const local = digits.startsWith("20") ? "0" + digits.slice(2) : digits;
  if (!/^01[0125]\d{8}$/.test(local)) reject("رقم الموبايل غير صحيح");
  return local;
}
function canonicalInput(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) reject("بيانات الطلب غير صحيحة");
  const keys = Object.keys(data);
  if (keys.some(k => !["requestId","checkoutMode","customer","phone","gov","address","notes","items"].includes(k))) reject("حقول غير مسموحة");
  if (!/^[a-f0-9-]{36}$/i.test(data.requestId || "")) reject("معرّف الطلب غير صحيح");
  if (!["registered","guest"].includes(data.checkoutMode)) reject("نوع الطلب غير صحيح");
  if (!stringField(data.customer, 2, 80) || !stringField(data.address, 5, 500) || !stringField(data.notes ?? "", 0, 500)) reject("بيانات التوصيل غير مكتملة");
  if (!REGIONS.includes(data.gov)) reject("المحافظة غير مدعومة");
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 20) reject("عدد الأصناف غير صحيح");
  const items = data.items.map(x => {
    if (!x || typeof x !== "object" || Object.keys(x).some(k => !["productId","size","qty"].includes(k)) ||
        !stringField(x.productId, 1, 100) || !stringField(x.size, 1, 40) ||
        !Number.isInteger(x.qty) || x.qty < 1 || x.qty > 10) reject("بيانات صنف غير صحيحة");
    return {productId:x.productId.trim(),size:x.size.trim(),qty:x.qty};
  });
  if (items.reduce((n,x)=>n+x.qty,0)>30) reject("عدد القطع أكبر من الحد");
  if (new Set(items.map(x=>x.productId+"|"+x.size)).size!==items.length) reject("أصناف مكررة");
  return {requestId:data.requestId.toLowerCase(),checkoutMode:data.checkoutMode,customer:data.customer.trim(),phone:normalizePhone(data.phone),gov:data.gov,address:data.address.trim(),notes:(data.notes||"").trim(),items};
}
exports.createOrkaOrder = onCall({
  region:"me-central1",
  enforceAppCheck:true,
  maxInstances:10,
  timeoutSeconds:30,
  memory:"256MiB"
}, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated","يجب بدء جلسة آمنة قبل إتمام الطلب");
  const input=canonicalInput(request.data);
  const guest = request.auth.token.firebase?.sign_in_provider === "anonymous";
  if (guest !== (input.checkoutMode === "guest")) reject("نوع جلسة الشراء غير متطابق");
  const uid=request.auth.uid;
  const fingerprint=crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const orderId=crypto.createHash("sha256").update(uid+":"+input.requestId).digest("hex").slice(0,40);
  const orderRef=db.collection("orders").doc(orderId);
  const throttleRef=db.collection("checkoutRateLimits").doc(uid);
  const catalogRefs=input.items.map(x=>db.collection("catalog").doc(x.productId));
  const result=await db.runTransaction(async tx=>{
    // All reads precede writes, as required by Firestore transactions.
    const existing=await tx.get(orderRef);
    if (existing.exists) {
      const old=existing.data();
      if (old.requestFingerprint!==fingerprint || old.uid!==uid) throw new HttpsError("already-exists","تم استخدام معرّف الطلب ببيانات مختلفة");
      return {orderId,totalEGP:old.totalEGP,reused:true};
    }
    const throttle=await tx.get(throttleRef);
    const products=await Promise.all(catalogRefs.map(ref=>tx.get(ref)));
    const now=Date.now();
    const previous=throttle.exists?throttle.data():{};
    // Per-UID throttle is defense-in-depth, not a substitute for IP/device abuse controls.
    if (previous.lastAtMs && now-previous.lastAtMs<15000) throw new HttpsError("resource-exhausted","انتظر قليلًا قبل طلب جديد");
    let totalEGP=0;
    const items=input.items.map((x,i)=>{
      const snap=products[i];
      if (!snap.exists) reject("منتج غير متاح");
      const p=snap.data();
      if (p.active!==true || !Array.isArray(p.sizes) || !p.sizes.includes(x.size) ||
          !Number.isInteger(p.priceEGP) || p.priceEGP<=0 ||
          (p.maxPerOrder && x.qty>p.maxPerOrder)) reject("الموديل أو المقاس غير متاح");
      const lineEGP=p.priceEGP*x.qty;
      totalEGP+=lineEGP;
      return {productId:x.productId,name:String(p.name||"").slice(0,100),size:x.size,qty:x.qty,unitPriceEGP:p.priceEGP,lineEGP};
    });
    if (!Number.isSafeInteger(totalEGP) || totalEGP<=0 || totalEGP>1000000) reject("إجمالي الطلب غير صالح");
    // Shipping and discounts deliberately disabled pending trusted policy configuration.
    const order={uid,checkoutMode:input.checkoutMode,customer:input.customer,phone:input.phone,gov:input.gov,address:input.address,notes:input.notes,items,totalEGP,shippingEGP:0,discountEGP:0,status:"pending",loyaltyEligible:false,pointsAwarded:false,requestFingerprint:fingerprint,createdAt:FieldValue.serverTimestamp()};
    tx.create(orderRef,order);
    tx.set(throttleRef,{lastAtMs:now},{merge:true});
    return {orderId,totalEGP,reused:false};
  });
  return result;
});
