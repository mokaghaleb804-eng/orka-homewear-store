'use strict';
// Preview-only transactional contract using an injected transaction adapter.
// The adapter must provide a SERIALIZABLE durable transaction before production use.
// No Firebase SDK, network calls, or live credentials.
const {earn,grant,redeem}=require('./orka-club-wallet-engine.cjs');
function assertIdentity(uid){if(typeof uid!=='string'||!uid.trim())throw Error('Authenticated UID required')}
function assertTrustedOrder(order,uid){
 if(!order||order.ownerUid!==uid||order.status!=='delivered'||order.source!=='trusted-server')throw Error('Unverified order');
 if(!Number.isSafeInteger(order.eligibleSubtotalPiastres)||order.eligibleSubtotalPiastres<0)throw Error('Invalid trusted price');
}
async function grantForDelivery(store,{uid,order}){
 assertIdentity(uid);assertTrustedOrder(order,uid);
 if(typeof order.id!=='string'||!order.id)throw Error('Order ID required');
 return store.transaction(async tx=>{
  const key='grant:'+order.id,existing=tx.operation(key);
  if(existing){if(existing.uid!==uid)throw Error('Order ownership conflict');return existing.result}
  const amount=order.usedWallet||!order.fullPrice?0:earn(order.eligibleSubtotalPiastres);
  if(amount)tx.putCredit(uid,grant({id:key,amount,issuedAt:order.deliveredAt}));
  const result={amount,orderId:order.id};
  tx.putOperation(key,{uid,result});return result;
 });
}
async function redeemOneUnit(store,{uid,redemptionId,orderId,unitId,unitPricePiastres,now}){
 assertIdentity(uid);
 if(!redemptionId||!orderId||!unitId||!Number.isSafeInteger(unitPricePiastres)||unitPricePiastres<0)throw Error('Invalid redemption');
 // Caller MUST be a trusted server, using its own validated price snapshot and unit selection.
 return store.transaction(async tx=>{
  const key='redeem:'+redemptionId,signature=JSON.stringify({uid,orderId,unitId,unitPricePiastres});
  const existing=tx.operation(key);
  if(existing){if(existing.signature!==signature)throw Error('Idempotency conflict');return existing.result}
  const result=redeem({credits:tx.credits(uid),pricePiastres:unitPricePiastres,now});
  tx.replaceCredits(uid,result.credits);
  const response={discount:result.discount,due:result.due,debits:result.debits,orderId,unitId};
  tx.putOperation(key,{uid,signature,result:response});return response;
 });
}
module.exports={grantForDelivery,redeemOneUnit};
