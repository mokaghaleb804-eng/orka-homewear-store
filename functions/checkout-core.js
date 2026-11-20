const crypto=require("node:crypto");
function createCheckoutService({db,HttpsError,FieldValue,now=Date.now}) {
const REGIONS = ["القاهرة","الجيزة","الإسكندرية","القليوبية","الشرقية","الغربية","المنوفية","الدقهلية","البحيرة","كفر الشيخ","دمياط","بورسعيد","الإسماعيلية","السويس","الفيوم","بني سويف","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","البحر الأحمر","الوادي الجديد","مطروح","شمال سيناء","جنوب سيناء"];
function stringField(v, min, max) {
  return typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
}
function reject(message) { throw new HttpsError("invalid-argument", message); }
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fingerprintOf=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function normalizePhone(v) {
  if(typeof v!=="string" || !/^[0-9+() -]{10,24}$/.test(v)) reject("رقم الموبايل غير صحيح");
  const digits = v.replace(/[+() -]/g, "");
  const local = digits.startsWith("0020") ? "0"+digits.slice(4) : digits.startsWith("20") ? "0" + digits.slice(2) : digits;
  if (!/^01[0125]\d{8}$/.test(local)) reject("رقم الموبايل غير صحيح");
  return local;
}
function canonicalInput(data, creating=false) {
  if (!data || typeof data !== "object" || Array.isArray(data)) reject("بيانات الطلب غير صحيحة");
  const keys = Object.keys(data);
  if (keys.some(k => !["requestId","checkoutMode","customer","phone","gov","address","notes","items",...(creating?["quoteId"]:[])].includes(k))) reject("حقول غير مسموحة");
  if (typeof data.requestId!=="string" || !UUID.test(data.requestId)) reject("معرّف الطلب غير صحيح");
  if (creating && (typeof data.quoteId!=="string" || !UUID.test(data.quoteId))) reject("عرض السعر مطلوب");
  if (!["registered","guest"].includes(data.checkoutMode)) reject("نوع الطلب غير صحيح");
  if (!stringField(data.customer, 2, 80) || !stringField(data.address, 5, 500) || !stringField(data.notes ?? "", 0, 500)) reject("بيانات التوصيل غير مكتملة");
  if (!REGIONS.includes(data.gov)) reject("المحافظة غير مدعومة");
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 20) reject("عدد الأصناف غير صحيح");
  const items = data.items.map(x => {
    if (!x || typeof x !== "object" || Array.isArray(x) || Object.keys(x).some(k => !["productId","size","qty"].includes(k)) ||
        !stringField(x.productId, 1, 100) || !stringField(x.size, 1, 40) ||
        !Number.isInteger(x.qty) || x.qty < 1 || x.qty > 10) reject("بيانات صنف غير صحيحة");
    const productId=x.productId.trim();
    if(!/^[A-Za-z0-9_-]+$/.test(productId)) reject("معرّف المنتج غير صحيح");
    return {productId,size:x.size.trim(),qty:x.qty};
  }).sort((a,b)=>a.productId.localeCompare(b.productId,'en') || a.size.localeCompare(b.size,'en'));
  if (items.reduce((n,x)=>n+x.qty,0)>30) reject("عدد القطع أكبر من الحد");
  if (new Set(items.map(x=>JSON.stringify([x.productId,x.size]))).size!==items.length) reject("أصناف مكررة");
  return {requestId:data.requestId.toLowerCase(),checkoutMode:data.checkoutMode,customer:data.customer.trim(),phone:normalizePhone(data.phone),gov:data.gov,address:data.address.trim(),notes:(data.notes||"").trim(),items};
}
async function calculatePrice(tx,input) {
  const launch=await tx.get(db.doc('storeSettings/checkout'));
  const policy=launch.exists?launch.data():{};
  if(policy.enabled!==true || policy.paymentMethod!=="cod" || policy.catalogApproved!==true || policy.shippingApproved!==true || policy.abuseControlsApproved!==true) {
    throw new HttpsError('failed-precondition','الطلبات غير متاحة حتى اعتماد الإطلاق');
  }
  const shippingEGP=policy.shippingEGPByGovernorate?.[input.gov];
  if(!Number.isSafeInteger(shippingEGP) || shippingEGP<0 || shippingEGP>10000) throw new HttpsError('failed-precondition','تكلفة الشحن غير معتمدة');
  const products=await Promise.all(input.items.map(x=>tx.get(db.doc('catalog/'+x.productId))));
  const quantities={};
  for(const x of input.items) quantities[x.productId]=(quantities[x.productId]||0)+x.qty;
  let subtotalEGP=0;
  const items=input.items.map((x,i)=>{
    const p=products[i].exists?products[i].data():{};
    if(p.active!==true || !Array.isArray(p.sizes) || !p.sizes.includes(x.size) || !Number.isSafeInteger(p.priceEGP) || p.priceEGP<1 || p.priceEGP>1000000 || typeof p.name!=="string" || !p.name.trim() || p.name.length>100 || p.inventoryMode!=="made-to-order" || !Number.isInteger(p.maxPerOrder) || p.maxPerOrder<1 || p.maxPerOrder>30 || quantities[x.productId]>p.maxPerOrder) throw new HttpsError('failed-precondition','الموديل أو المقاس أو الكمية غير متاح');
    const lineEGP=p.priceEGP*x.qty; subtotalEGP+=lineEGP;
    return {productId:x.productId,name:p.name,size:x.size,qty:x.qty,unitPriceEGP:p.priceEGP,lineEGP};
  });
  const totalEGP=subtotalEGP+shippingEGP;
  if(!Number.isSafeInteger(totalEGP) || totalEGP<1 || totalEGP>1000000) reject('إجمالي الطلب غير صالح');
  return {items,subtotalEGP,shippingEGP,totalEGP,discountEGP:0,paymentMethod:'cod',preparationDays:{min:3,max:5}};
}
async function quoteOrkaOrder(request) {
  if(!request.auth?.uid) throw new HttpsError('unauthenticated','يجب بدء جلسة آمنة');
  const input=canonicalInput(request.data),uid=request.auth.uid;
  if((request.auth.token.firebase?.sign_in_provider==='anonymous')!==(input.checkoutMode==='guest')) reject('نوع جلسة الشراء غير متطابق');
  const quoteId=crypto.randomUUID();
  return db.runTransaction(async tx=>{
    const rateRef=db.doc('checkoutQuoteRateLimits/'+uid),rate=await tx.get(rateRef);
    if(rate.exists && now()-rate.data().lastAtMs<15000) throw new HttpsError('resource-exhausted','انتظر قليلًا قبل عرض جديد');
    const price=await calculatePrice(tx,input),expiresAtMs=now()+300000;
    tx.create(db.doc('checkoutQuotes/'+quoteId),{uid,inputFingerprint:fingerprintOf(input),price,expiresAtMs,createdAt:FieldValue.serverTimestamp()});
    tx.set(rateRef,{lastAtMs:now()});
    return {quoteId,expiresAtMs,...price};
  });
}
async function createOrkaOrder(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated","يجب بدء جلسة آمنة قبل إتمام الطلب");
  const input=canonicalInput(request.data,true);
  const guest = request.auth.token.firebase?.sign_in_provider === "anonymous";
  if (guest !== (input.checkoutMode === "guest")) reject("نوع جلسة الشراء غير متطابق");
  const uid=request.auth.uid;
  const fingerprint=crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const orderId=crypto.createHash("sha256").update(uid+":"+input.requestId).digest("hex").slice(0,40);
  const orderRef=db.collection("orders").doc(orderId);
  const throttleRef=db.collection("checkoutRateLimits").doc(uid);
  const result=await db.runTransaction(async tx=>{
    // All reads precede writes, as required by Firestore transactions.
    const existing=await tx.get(orderRef);
    if (existing.exists) {
      const old=existing.data();
      if (old.requestFingerprint!==fingerprint || old.uid!==uid) throw new HttpsError("already-exists","تم استخدام معرّف الطلب ببيانات مختلفة");
      return {orderId,totalEGP:old.totalEGP,reused:true};
    }
    const quoteId=request.data.quoteId.toLowerCase();
    const quote=await tx.get(db.doc('checkoutQuotes/'+quoteId));
    const q=quote.exists?quote.data():{};
    if(q.uid!==uid || q.inputFingerprint!==fingerprint || !Number.isFinite(q.expiresAtMs) || q.expiresAtMs<=now()) throw new HttpsError('failed-precondition','عرض السعر غير صالح؛ اطلب عرضًا جديدًا');
    const throttle=await tx.get(throttleRef);
    if(throttle.exists && now()-throttle.data().lastAtMs<15000) throw new HttpsError('resource-exhausted','انتظر قليلًا قبل طلب جديد');
    const price=await calculatePrice(tx,input);
    if(fingerprintOf(price)!==fingerprintOf(q.price)) throw new HttpsError('failed-precondition','تغير السعر أو الشحن؛ راجع الإجمالي الجديد قبل التأكيد');
    const order={...input,...price,uid,total:price.totalEGP,status:'pending',loyaltyEligible:false,pointsAwarded:false,requestFingerprint:fingerprint,quoteId,createdAt:FieldValue.serverTimestamp()};
    tx.create(orderRef,order);
    tx.set(throttleRef,{lastAtMs:now()},{merge:true});
    return {orderId,totalEGP:price.totalEGP,reused:false};
  });
  return result;
}


// DRAFT ONLY: server-authoritative admin order status transitions.
// This does not award loyalty points or trigger shipping provider actions.
const NEXT_ORDER_STATUS = Object.freeze({
  pending: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: []
});
async function updateOrkaOrderStatus(request) {
  const uid=request.auth?.uid;
  if (!uid || request.auth.token.firebase?.sign_in_provider==="anonymous") {
    throw new HttpsError("permission-denied","صلاحية المدير مطلوبة");
  }
  const data=request.data;
  if (!data || typeof data!=="object" || Array.isArray(data) ||
      Object.keys(data).some(k=>!["requestId","orderId","nextStatus","reason"].includes(k)) ||
      typeof data.requestId!=="string" || !UUID.test(data.requestId) ||
      !/^[a-f0-9]{40}$/.test(data.orderId||"") ||
      !["preparing","shipped","delivered","cancelled"].includes(data.nextStatus)) {
    reject("بيانات تحديث الطلب غير صحيحة");
  }
  if(data.reason!==undefined && typeof data.reason!=="string") reject("سبب غير صالح");
  const reason=(data.reason||"").trim();
  if (data.nextStatus==="cancelled" && (reason.length<5||reason.length>200)) reject("سبب الإلغاء مطلوب من 5 إلى 200 حرف");
  if (data.nextStatus!=="cancelled" && reason) reject("سبب الإلغاء مخصص للطلبات الملغاة فقط");
  const adminRef=db.collection("admins").doc(uid);
  const orderRef=db.collection("orders").doc(data.orderId);
  const auditRef=orderRef.collection("statusHistory").doc(fingerprintOf([uid,data.requestId.toLowerCase()]));
  const fingerprint=fingerprintOf([data.orderId,data.nextStatus,reason]);
  const result=await db.runTransaction(async tx=>{
    const audit=await tx.get(auditRef);
    const [adminSnap,orderSnap]=await Promise.all([tx.get(adminRef),tx.get(orderRef)]);
    if (!adminSnap.exists || adminSnap.data().role!=="admin") throw new HttpsError("permission-denied","غير مصرح لك بتعديل الطلبات");
    if (!orderSnap.exists) throw new HttpsError("not-found","الطلب غير موجود");
    const order=orderSnap.data();
    if(audit.exists) {
      if(audit.data().fingerprint!==fingerprint) throw new HttpsError('already-exists','استُخدم معرّف الإجراء ببيانات مختلفة');
      return {orderId:data.orderId,status:order.status,reused:true};
    }
    if (order.isTest===true || order.localOnly===true || order.test===true || order.orderType==="test" || order.environment==="test") reject("الطلبات التجريبية تُدار محليًا فقط");
    if (!Object.prototype.hasOwnProperty.call(NEXT_ORDER_STATUS,order.status) ||
        !NEXT_ORDER_STATUS[order.status].includes(data.nextStatus)) {
      throw new HttpsError("failed-precondition","انتقال حالة الطلب غير مسموح");
    }
    tx.update(orderRef,{
      status:data.nextStatus,
      statusUpdatedAt:FieldValue.serverTimestamp(),
      statusUpdatedBy:uid,
      ...(data.nextStatus==="cancelled"?{cancelReason:reason}:{})
    });
    tx.create(auditRef,{
      from:order.status,to:data.nextStatus,by:uid,fingerprint,
      reason:data.nextStatus==="cancelled"?reason:null,
      createdAt:FieldValue.serverTimestamp()
    });
    return {orderId:data.orderId,status:data.nextStatus};
  });
  return result;
}


return {quoteOrkaOrder,createOrkaOrder,updateOrkaOrderStatus};
}
module.exports={createCheckoutService};
