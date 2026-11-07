// DRAFT ONLY: browser checkout adapter. Not imported by the live storefront.
// Firebase v13 modular SDK; same Firebase app/config as the ORKA storefront.
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-functions.js";

/**
 * Call only after the user explicitly selects guest or registered checkout.
 * For registered checkout, the caller must already have a non-anonymous account.
 * A guest session uses Firebase Anonymous Auth, but is NOT a verified phone identity.
 */
export async function createOrkaCheckoutOrder(app, mode, customer, cart, requestId) {
  if (!["guest", "registered"].includes(mode)) throw new Error("اختار طريقة إتمام الطلب");
  const auth = getAuth(app);
  if (mode === "guest") {
    if (!auth.currentUser) await signInAnonymously(auth);
    if (!auth.currentUser?.isAnonymous) {
      throw new Error("أنت مسجل دخول بالفعل؛ استخدم الشراء بحسابك");
    }
  } else if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error("سجل دخولك بحساب Google أولًا");
  }
  if (!Array.isArray(cart) || !cart.length) throw new Error("السلة فارغة");
  // The live catalog must map each cart item to a stable productId before wiring this.
  const items = cart.map(item => ({
    productId: String(item.productId || ""),
    size: String(item.size || ""),
    qty: Number(item.qty)
  }));
  if (items.some(item => !item.productId || !item.size || !Number.isInteger(item.qty) || item.qty < 1)) {
    throw new Error("بيانات المنتج غير مكتملة؛ يلزم ربط الموديلات بالكتالوج");
  }
  const fn = httpsCallable(getFunctions(app, "me-central1"), "createOrkaOrder");
  const payload = {
    requestId,
    checkoutMode: mode,
    customer: customer.name,
    phone: customer.phone,
    gov: customer.gov,
    address: customer.address,
    notes: customer.notes || "",
    items
  };
  const result = await fn(payload);
  if (!result?.data?.orderId) throw new Error("لم نستلم رقم الطلب من الخادم");
  return result.data;
}

// Generate once when the customer starts a checkout attempt; persist it for retries.
// A new UUID on every network retry defeats server-side idempotency.
export function newOrkaCheckoutAttemptId() {
  return crypto.randomUUID();
}
