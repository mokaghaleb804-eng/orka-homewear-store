'use strict';
// Preview-only cart adapter: browser totals are intentionally ignored.
// Variant IDs MUST be provisioned from a trusted catalog; this adapter does not invent them.
function safeId(s){return typeof s==='string'&&s.length>0&&s.length<=128&&s!=='.'&&s!=='..'&&!s.includes('/')&&!s.includes('\\')&&!/[\u0000-\u001f]/.test(s)}
function cartToCheckoutUnits(cart,{resolveVariantId}={}){
 if(!Array.isArray(cart)||!cart.length||cart.length>50||typeof resolveVariantId!=='function')throw Error('Invalid cart');
 const units=[];
 for(let line=0;line<cart.length;line++){
  const item=cart[line];
  if(!item||typeof item!=='object'||!Number.isSafeInteger(item.qty)||item.qty<1||item.qty>50||!safeId(item.productId)||typeof item.size!=='string'||!item.size.trim()||typeof item.color!=='string'||!item.color.trim())throw Error('Invalid cart line');
  const variantId=resolveVariantId({productId:item.productId,size:item.size,color:item.color});
  if(!safeId(variantId))throw Error('Unmapped catalog variant');
  for(let n=0;n<item.qty;n++){
   const unitId='line'+line+'-unit'+n;
   units.push({unitId,productId:variantId});
   if(units.length>50)throw Error('Cart unit limit exceeded');
  }
 }
 return units;
}
module.exports={cartToCheckoutUnits};
