// Preview-only admin adapter; do not import into production until emulator tests pass.
import {getAuth} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {getFunctions, httpsCallable} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-functions.js";
const nextStatuses = Object.freeze({
  pending:["preparing","cancelled"],
  preparing:["shipped","cancelled"],
  shipped:["delivered","cancelled"],
  delivered:[],
  cancelled:[]
});
export function allowedOrkaOrderActions(status) {
  return nextStatuses[status] || [];
}
export async function updateOrkaOrderStatus(app, order, nextStatus, reason="") {
  if (!order || order.isTest || order.localOnly) throw Error("الطلبات التجريبية محلية فقط");
  if (!allowedOrkaOrderActions(order.status).includes(nextStatus)) throw Error("انتقال الحالة غير مسموح");
  const user=getAuth(app).currentUser;
  if (!user || user.isAnonymous) throw Error("سجل دخول المدير أولًا");
  const fn=httpsCallable(getFunctions(app,"me-central1"),"updateOrkaOrderStatus");
  const result=await fn({orderId:order.id,nextStatus,reason:nextStatus==="cancelled"?reason:""});
  return result.data;
}
