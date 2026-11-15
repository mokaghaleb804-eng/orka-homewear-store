'use strict';
// PREVIEW ONLY. Server-side catalog lookup; no client-provided variant identifiers or prices.
// Proposed schema: variantMappings/{productId} = {active:true,variants:[{variantId,size,color,active}]}.
// This is a draft schema, not a claim that these Firestore documents exist in production.
const {createTrustedVariantResolver}=require('./orka-club-trusted-variant-registry.cjs');
const {cartToCheckoutUnits}=require('./orka-club-cart-variant-adapter.cjs');
function validId(s){return typeof s==='string'&&s.length>0&&s.length<=128&&s!=='.'&&s!=='..'&&!/[\\/\u0000-\u001f]/.test(s)}
function createFirestoreVariantResolver(db){
 if(!db||typeof db.doc!=='function')throw Error('Firestore Admin required');
 return async function resolveVariants(cart){
  if(!Array.isArray(cart)||!cart.length||cart.length>50)throw Error('Invalid cart');
  // Validate quantities, sizes, colors and total units before reading any Firestore documents.
  cartToCheckoutUnits(cart,{resolveVariantId:()=> 'validation-only'});
  const ids=[...new Set(cart.map(item=>item.productId))];
  if(ids.some(id=>!validId(id)))throw Error('Invalid product ID');
  const records=[];
  for(const id of ids){
   const snap=await db.doc('variantMappings/'+id).get();
   if(!snap.exists)throw Error('Unmapped catalog product');
   const doc=snap.data();
   if(!doc||doc.active!==true||!Array.isArray(doc.variants)||doc.variants.length>72)throw Error('Unavailable variant mapping');
   for(const variant of doc.variants){
    if(!variant||typeof variant!=='object')throw Error('Invalid catalog variant');
    records.push({productId:id,variantId:variant.variantId,size:variant.size,color:variant.color,active:variant.active});
   }
  }
  const resolveVariantId=createTrustedVariantResolver(records);
  return resolveVariantId;
 };
}
function createFirestoreCartUnitResolver(db){
 const resolveVariants=createFirestoreVariantResolver(db);
 return async cart=>cartToCheckoutUnits(cart,{resolveVariantId:await resolveVariants(cart)});
}
module.exports={createFirestoreVariantResolver,createFirestoreCartUnitResolver};
