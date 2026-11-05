// ORKA fulfillment state machine — server-side domain prototype only.
// No Firebase writes, no live loyalty activation.
import {CheckoutError} from './trusted-order-calculator.mjs';
const transitions=Object.freeze({
 pending:['confirmed','cancelled'],
 confirmed:['preparing','cancelled'],
 preparing:['shipped','cancelled'],
 shipped:['delivered','returned'],
 delivered:['returned'],
 cancelled:[],
 returned:[]
});
export function transitionOrder(order,nextStatus,{actorRole,at}={}){
 if(actorRole!=='admin')throw new CheckoutError('FORBIDDEN','Admin required');
 if(!order||typeof order!=='object')throw new CheckoutError('INVALID_ORDER','Order required');
 if(typeof nextStatus!=='string'||!Object.hasOwn(transitions,order.status)||!transitions[order.status].includes(nextStatus))
  throw new CheckoutError('INVALID_TRANSITION','Status change not allowed');
 if(typeof at!=='string'||!Number.isFinite(Date.parse(at)))throw new CheckoutError('INVALID_TIME','Server timestamp required');
 const updated={...order,status:nextStatus,statusUpdatedAt:at};
 if(nextStatus==='delivered')updated.deliveredAt=at;
 if(nextStatus==='returned')updated.returnedAt=at;
 if(nextStatus==='cancelled')updated.cancelledAt=at;
 // Points must be granted in a separate, atomic, idempotent trusted-server transaction.
 // Returning a delivered order requires a reversal policy, NOT a silent balance change.
 return updated;
}
export function rewardAccrualEligibility(order){
 return Boolean(order&&order.status==='delivered'&&order.loyaltyAccrued!==true&&Number.isSafeInteger(order.payableCents)&&order.payableCents>=0);
}
