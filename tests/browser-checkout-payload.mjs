// Browser-side payload builder for a future authenticated ORKA checkout.
// Pure, side-effect-free; does not send requests or connect to Firebase.
const SIZES=new Set(['3-4Y','5-6Y','7-8Y','9-10Y','11-12Y','13-14Y']);
export function buildCheckoutRequest({cart,delivery,requestKey}={}){
 if(!Array.isArray(cart)||!cart.length||cart.length>30)throw Error('INVALID_ITEMS');
 const items=cart.map(line=>{
  const id=Number(line?.id),quantity=Number(line?.qty),size=line?.size;
  if(!Number.isInteger(id)||id<1||id>10||!Number.isInteger(quantity)||quantity<1||quantity>20||!SIZES.has(size))throw Error('INVALID_ITEMS');
  return {productId:'look-'+String(id).padStart(2,'0'),size,quantity};
 });
 if(typeof requestKey!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(requestKey))throw Error('INVALID_REQUEST_KEY');
 return {requestKey,checkout:{name:String(delivery?.name??'').trim(),shippingPhone:String(delivery?.phone??'').trim(),governorate:String(delivery?.gov??'').trim(),address:String(delivery?.address??'').trim(),items}};
}
// The server must independently resolve product IDs, stock, prices, and verified UID.
// These preview IDs are NOT a production catalog.
