'use strict';
const assert=require('node:assert/strict');
const {createLedger}=require('./orka-club-ledger-preview.cjs');
const {grant,redeem}=require('./orka-club-wallet-engine.cjs');
// Negative/security acceptance cases. These are EXPECTED FAILURES of the preview model,
// documenting why it must never be connected to production.
const risks=[];
function vulnerability(name,fn){try{if(fn())risks.push(name)}catch(e){risks.push(name+': '+e.message)}}
vulnerability('CLIENT_CAN_FORGE_DELIVERY_AND_PRICE',()=>{
 const ledger=createLedger();ledger.delivered({accountId:'attacker',orderId:'fake',eligibleSubtotalPiastres:100000000,deliveredAt:'2026-11-01T00:00:00Z'});
 return ledger.snapshot('attacker')[0].remaining===10000000;
});
vulnerability('ACCOUNT_OWNERSHIP_NOT_AUTHENTICATED',()=>{
 const ledger=createLedger();ledger.delivered({accountId:'victim',orderId:'order-v',eligibleSubtotalPiastres:100000,deliveredAt:'2026-11-01T00:00:00Z'});
 return ledger.spend({accountId:'victim',redemptionId:'stolen',itemPricePiastres:5000,now:'2026-11-02T00:00:00Z'}).discount===5000;
});
vulnerability('RESTART_LOSES_WALLET_STATE',()=>{
 const ledger=createLedger();ledger.delivered({accountId:'customer',orderId:'order',eligibleSubtotalPiastres:100000,deliveredAt:'2026-11-01T00:00:00Z'});
 return createLedger().snapshot('customer').length===0;
});
vulnerability('REFUNDS_HAVE_NO_REVERSAL_API',()=>typeof createLedger().reverse!=='function');
vulnerability('REPLAY_RETURNS_DIFFERENT_RESULT',()=>{
 const ledger=createLedger();ledger.delivered({accountId:'customer',orderId:'order',eligibleSubtotalPiastres:100000,deliveredAt:'2026-11-01T00:00:00Z'});
 const req={accountId:'customer',redemptionId:'one',itemPricePiastres:5000,now:'2026-11-02T00:00:00Z'};
 return ledger.spend(req).discount!==ledger.spend(req).discount;
});
assert.equal(risks.length,5,'Expected five known blockers to remain documented');
console.log('KNOWN BLOCKERS (5): '+risks.join('; '));
console.log('Negative test harness passed: blockers are detected, NOT resolved.');
