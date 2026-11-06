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
 const name=String(delivery?.name??'').trim();
 const shippingPhone=String(delivery?.phone??'').replace(/[\s()-]/g,'');
 const governorate=String(delivery?.gov??'').trim();
 const address=String(delivery?.address??'').trim();
 if(name.length<2||name.length>80)throw Error('INVALID_NAME');
 if(!/^(?:\+?20|0)?1[0125]\d{8}$/.test(shippingPhone))throw Error('INVALID_PHONE');
 if(!governorate||governorate.length>60)throw Error('INVALID_GOVERNORATE');
 if(address.length<8||address.length>500)throw Error('INVALID_ADDRESS');
 if(typeof requestKey!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(requestKey))throw Error('INVALID_REQUEST_KEY');
 return {requestKey,checkout:{name,shippingPhone,governorate,address,items}};
}
// The server must independently resolve product IDs, stock, prices, and verified UID.
// These preview IDs are NOT a production catalog.
