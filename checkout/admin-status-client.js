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
  if(app.options.projectId!=="demo-orka-checkout" || app.name!=="orka-emulator-preview") throw Error("المحاكي التجريبي فقط");
  if (!order || order.isTest || order.localOnly) throw Error("الطلبات التجريبية محلية فقط");
  if (!allowedOrkaOrderActions(order.status).includes(nextStatus)) throw Error("انتقال الحالة غير مسموح");
  const user=getAuth(app).currentUser;
  if (!user || user.isAnonymous) throw Error("سجل دخول المدير أولًا");
  const payload={orderId:order.id,nextStatus,reason:nextStatus==="cancelled"?reason.trim():""};
  const key='orka.status.attempt.'+user.uid+'.'+order.id;
  let attempt=JSON.parse(sessionStorage.getItem(key)||'null');
  const fn=httpsCallable(getFunctions(app,location.origin+'/__functions'),"updateOrkaOrderStatus");
  if(attempt?.pending && JSON.stringify(attempt.payload)!==JSON.stringify(payload)) {
    const previous=await fn({...attempt.payload,requestId:attempt.requestId});
    attempt.pending=false;sessionStorage.setItem(key,JSON.stringify(attempt));
    return previous.data; // Resolve the uncertain action, refresh, then allow a new choice.
  }
  if(!attempt?.pending) attempt={requestId:crypto.randomUUID(),payload,pending:true};
  sessionStorage.setItem(key,JSON.stringify(attempt));
  let result;
  try {result=await fn({...payload,requestId:attempt.requestId});}
  catch(error){if(['functions/failed-precondition','functions/invalid-argument','functions/permission-denied','functions/not-found'].includes(error.code)){attempt.pending=false;sessionStorage.setItem(key,JSON.stringify(attempt));}throw error;}
  attempt.pending=false;sessionStorage.setItem(key,JSON.stringify(attempt));
  return result.data;
}

