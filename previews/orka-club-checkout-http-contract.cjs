'use strict';
// SERVER ONLY: framework-neutral request handler contract, NOT a deployed route.
// The Firebase Admin backend must be instantiated in a trusted server runtime.
function validId(s){return typeof s==='string'&&s.length>0&&s.length<=128&&s!=='.'&&s!=='..'&&!s.includes('/')&&!s.includes('\\')&&!/[\u0000-\u001f]/.test(s)}
function createCheckoutHttpHandler(backend){
 if(!backend||typeof backend.createCheckout!=='function')throw Error('Checkout backend required');
 return async function handleCheckout(request){
  if(request?.method!=='POST')return {status:405,headers:{Allow:'POST'},body:{error:'Method not allowed'}};
  const type=String(request.headers?.['content-type']??request.headers?.['Content-Type']??'').split(';')[0].trim().toLowerCase();
  if(type!=='application/json')return {status:415,body:{error:'JSON required'}};
  const auth=request.headers?.authorization??request.headers?.Authorization;
  if(typeof auth!=='string'||!/^Bearer [^\s]+$/.test(auth))return {status:401,body:{error:'Authentication required'}};
  const body=request.body;
  if(!body||typeof body!=='object'||Array.isArray(body))return {status:400,body:{error:'Invalid request'}};
  const allowed=new Set(['orderId','items','shippingAddress','walletUnitId']);
  if(Object.keys(body).some(key=>!allowed.has(key)))return {status:400,body:{error:'Unexpected checkout field'}};
  if(!validId(body.orderId)||!Array.isArray(body.items)||!body.items.length||body.items.length>50)return {status:400,body:{error:'Invalid checkout input'}};
  if(!body.shippingAddress||typeof body.shippingAddress!=='object'||Array.isArray(body.shippingAddress)||Object.keys(body.shippingAddress).length!==1||!validId(body.shippingAddress.zoneId))return {status:400,body:{error:'Invalid shipping address'}};
  if(body.items.some(item=>!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['unitId','productId'].includes(k))))return {status:400,body:{error:'Unexpected item field'}};
  if(body.walletUnitId!=null&&!validId(body.walletUnitId))return {status:400,body:{error:'Invalid wallet unit'}};
  if(body.items.some(item=>!validId(item.unitId)||!validId(item.productId)))return {status:400,body:{error:'Invalid unit or product ID'}};
  const unitIds=body.items.map(item=>item.unitId);
  if(new Set(unitIds).size!==unitIds.length)return {status:400,body:{error:'Duplicate unit ID'}};
  if(body.walletUnitId!=null&&!unitIds.includes(body.walletUnitId))return {status:400,body:{error:'Wallet unit not in order'}};
  try{
   const result=await backend.createCheckout({identityToken:auth.slice(7),orderId:body.orderId,items:body.items,shippingAddress:body.shippingAddress,walletUnitId:body.walletUnitId});
   return {status:result.duplicate?200:201,body:{orderId:result.order.orderId,subtotalPiastres:result.order.eligibleSubtotalPiastres,shippingPiastres:result.order.shippingPiastres,totalPiastres:result.order.totalPiastres,duplicate:result.duplicate}};
  }catch(err){
   // Fail closed: never leak internal catalog, Firebase or Firestore errors.
   return {status:422,body:{error:'Checkout could not be validated'}};
  }
 };
}
module.exports={createCheckoutHttpHandler};
