'use strict';
// SERVER-ONLY draft: price and shipping must come from trusted backend catalog.
// This is a validation contract, not a deployed checkout endpoint.
function money(n){return Number.isSafeInteger(n)&&n>=0}
function id(x){return typeof x==='string'&&x.length>0&&!x.includes('/')}
function buildTrustedCheckout({authenticatedUid,items,catalog,shippingPiastres,orderId}){
 if(!id(authenticatedUid)||!id(orderId)||!Array.isArray(items)||items.length===0||!money(shippingPiastres))throw Error('Invalid checkout request');
 if(!catalog||typeof catalog!=='object')throw Error('Trusted catalog required');
 const seen=new Set();let subtotal=0;const units=[];
 for(const item of items){
  if(!item||!id(item.unitId)||!id(item.productId)||seen.has(item.unitId))throw Error('Invalid or duplicate unit');
  seen.add(item.unitId);
  const product=catalog[item.productId];
  if(!product||product.active!==true||!money(product.pricePiastres)||product.fullPrice!==true)throw Error('Unavailable trusted product');
  // Client-supplied price, discount and totals are never used.
  subtotal+=product.pricePiastres;
  if(!Number.isSafeInteger(subtotal))throw Error('Checkout total overflow');
  units.push({id:item.unitId,productId:item.productId,pricePiastres:product.pricePiastres});
 }
 const total=subtotal+shippingPiastres;
 if(!Number.isSafeInteger(total))throw Error('Checkout total overflow');
 return {uid:authenticatedUid,orderId,status:'pending',checkoutValidatedByServer:true,usedWallet:false,fullPrice:true,eligibleSubtotalPiastres:subtotal,shippingPiastres,totalPiastres:total,units};
}
function selectWalletUnit(checkout,unitId){
 if(!checkout||checkout.checkoutValidatedByServer!==true||!id(unitId))throw Error('Invalid trusted checkout');
 const unit=checkout.units.find(u=>u.id===unitId);
 if(!unit)throw Error('Unit not in checkout');
 return {...checkout,walletRedemptionUnit:{id:unit.id,pricePiastres:unit.pricePiastres}};
}
module.exports={buildTrustedCheckout,selectWalletUnit};
