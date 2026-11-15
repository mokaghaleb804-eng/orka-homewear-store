'use strict';
// Isolated in-memory acceptance prototype only. NOT a database, server, payment integration or production wallet.
const {earn,grant,redeem}=require('./orka-club-wallet-engine.cjs');
function createLedger(){
 const accounts=new Map(), events=new Set();
 const get=id=>{if(!id)throw Error('Authenticated account required');if(!accounts.has(id))accounts.set(id,[]);return accounts.get(id)};
 return {
  snapshot(accountId){return get(accountId).map(c=>({...c}))},
  delivered({accountId,orderId,eligibleSubtotalPiastres,deliveredAt,fullPrice=true,usedWallet=false}){
   if(!orderId)throw Error('Order ID required');
   const key='grant:'+orderId;if(events.has(key))return {duplicate:true,amount:0};
   // Production must obtain delivery/price/account data from trusted server, never request payload.
   if(!fullPrice||usedWallet){events.add(key);return {duplicate:false,amount:0}}
   const amount=earn(eligibleSubtotalPiastres);
   get(accountId).push(grant({id:key,amount,issuedAt:deliveredAt}));
   events.add(key);return {duplicate:false,amount};
  },
  spend({accountId,redemptionId,itemPricePiastres,now}){
   if(!redemptionId)throw Error('Redemption ID required');
   const key='spend:'+accountId+':'+redemptionId;
   if(events.has(key))return {duplicate:true,discount:0};
   const previous=get(accountId),result=redeem({credits:previous,pricePiastres:itemPricePiastres,now});
   accounts.set(accountId,result.credits);events.add(key);
   return {duplicate:false,discount:result.discount,due:result.due,debits:result.debits};
  }
 }
}
module.exports={createLedger};
