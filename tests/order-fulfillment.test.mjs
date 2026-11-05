import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionOrder,rewardAccrualEligibility} from './order-fulfillment.mjs';
const t='2026-11-06T12:00:00.000Z';
const base={orderId:'test-1',uid:'customer-1',status:'pending',payableCents:85000,loyaltyAccrued:false};
const next=(order,status,role='admin')=>transitionOrder(order,status,{actorRole:role,at:t});
test('admin can follow complete order lifecycle',()=>{
 let order=base;
 for(const status of ['confirmed','preparing','shipped','delivered'])order=next(order,status);
 assert.equal(order.status,'delivered');
 assert.equal(order.deliveredAt,t);
 assert.equal(rewardAccrualEligibility(order),true);
});
test('customer cannot change order status',()=>assert.throws(()=>next(base,'confirmed','customer'),{code:'FORBIDDEN'}));
test('cannot skip stages or deliver twice',()=>{
 assert.throws(()=>next(base,'delivered'),{code:'INVALID_TRANSITION'});
 const shipped=next(next(next(base,'confirmed'),'preparing'),'shipped');
 const delivered=next(shipped,'delivered');
 assert.throws(()=>next(delivered,'delivered'),{code:'INVALID_TRANSITION'});
});
test('cancelled order cannot progress',()=>{
 const cancelled=next(base,'cancelled');
 assert.equal(rewardAccrualEligibility(cancelled),false);
 assert.throws(()=>next(cancelled,'confirmed'),{code:'INVALID_TRANSITION'});
});
test('returned order needs separate reward reversal handling',()=>{
 let order=base;
 for(const status of ['confirmed','preparing','shipped','delivered','returned'])order=next(order,status);
 assert.equal(order.status,'returned');
 assert.equal(rewardAccrualEligibility(order),false);
});
test('already accrued reward is ineligible for repeat accrual',()=>{
 assert.equal(rewardAccrualEligibility({...base,status:'delivered',loyaltyAccrued:true}),false);
});
