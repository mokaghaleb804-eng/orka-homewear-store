'use strict';
// Preview-only trusted variant registry adapter. Records MUST originate from server-controlled catalog.
// No browser-supplied price, availability, or variant ID may be trusted.
const {cartToCheckoutUnits}=require('./orka-club-cart-variant-adapter.cjs');
const SIZES=new Set(['2','4','6','8','10','12']);
function safeId(s){return typeof s==='string'&&s.length>0&&s.length<=128&&s!=='.'&&s!=='..'&&!/[\\/\u0000-\u001f]/.test(s)}
function createTrustedVariantResolver(records){
 if(!Array.isArray(records))throw Error('Trusted variant records required');
 const map=new Map();
 for(const record of records){
  if(!record||!safeId(record.productId)||!safeId(record.variantId)||!SIZES.has(record.size)||typeof record.color!=='string'||!record.color.trim()||record.color!==record.color.trim()||typeof record.active!=='boolean')throw Error('Invalid trusted variant record');
  const key=JSON.stringify([record.productId,record.size,record.color]);
  if(map.has(key))throw Error('Duplicate trusted variant mapping');
  map.set(key,record.active?record.variantId:null);
 }
 return ({productId,size,color})=>map.get(JSON.stringify([productId,size,color]))??null;
}
function trustedCartToCheckoutUnits(cart,records){
 return cartToCheckoutUnits(cart,{resolveVariantId:createTrustedVariantResolver(records)});
}
module.exports={createTrustedVariantResolver,trustedCartToCheckoutUnits};
