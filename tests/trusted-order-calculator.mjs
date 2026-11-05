// ORKA server-side order calculation prototype. REVIEW/TEST ONLY; not connected to Firebase.
// This module must run only on a trusted server. Never import it in the storefront browser.
export class CheckoutError extends Error {
  constructor(code,message){super(message);this.name='CheckoutError';this.code=code;}
}
const fail=(code,message)=>{throw new CheckoutError(code,message);};
const roundCents=n=>Math.round((n+Number.EPSILON)*100);
const validPhone=value=>{
 let digits=String(value??'').replace(/\D/g,'');
 if(digits.startsWith('0020'))digits=digits.slice(2);
 if(/^01[0125]\d{8}$/.test(digits))digits='2'+digits;
 if(!/^201[0125]\d{8}$/.test(digits))fail('INVALID_PHONE','Invalid Egyptian shipping phone');
 return '+'+digits;
};
const str=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max?value.trim():null;
export function calculateTrustedOrder({authUid=null,checkout,catalog}) {
 if(authUid!==null&&(!str(authUid,128)))fail('INVALID_IDENTITY','Invalid user ID');
 if(!checkout||typeof checkout!=='object')fail('INVALID_CHECKOUT','Missing checkout');
 const customer=str(checkout.name,80),shippingPhone=validPhone(checkout.shippingPhone);
 const gov=str(checkout.governorate,60),address=str(checkout.address,500);
 const notes=checkout.notes==null?'':String(checkout.notes).trim();
 if(!customer||customer.length<2||!gov||!address||address.length<8||notes.length>500)fail('INVALID_ADDRESS','Invalid shipping details');
 if(!Array.isArray(checkout.items)||checkout.items.length<1||checkout.items.length>30)fail('INVALID_ITEMS','Invalid cart');
 if(!catalog||typeof catalog!=='object')fail('CATALOG_UNAVAILABLE','Trusted catalog missing');
 let totalCents=0;
 const requestedBySkuSize=new Map();
 const items=checkout.items.map(item=>{
  const id=str(item?.productId,120),size=str(item?.size,40),qty=item?.quantity;
  if(!id||!size||!Number.isInteger(qty)||qty<1||qty>20)fail('INVALID_ITEMS','Invalid item');
  const product=Object.hasOwn(catalog,id)?catalog[id]:null;
  if(!product||product.active!==true)fail('UNAVAILABLE_PRODUCT','Product not available');
  if(!Array.isArray(product.sizes)||!product.sizes.includes(size))fail('INVALID_SIZE','Size unavailable');
  if(!Number.isSafeInteger(product.priceCents)||product.priceCents<=0)fail('UNPRICED_PRODUCT','Missing approved price');
  if(product.stockBySize&&(!Number.isSafeInteger(product.stockBySize[size])||product.stockBySize[size]<qty))fail('OUT_OF_STOCK','Insufficient stock');
  const stockKey=JSON.stringify([id,size]);
  const aggregateQty=(requestedBySkuSize.get(stockKey)||0)+qty;
  if(aggregateQty>20)fail('INVALID_ITEMS','Combined quantity too large');
  requestedBySkuSize.set(stockKey,aggregateQty);
  if(product.stockBySize&&product.stockBySize[size]<aggregateQty)fail('OUT_OF_STOCK','Combined quantity exceeds stock');
  const lineCents=product.priceCents*qty;
  if(!Number.isSafeInteger(lineCents)||!Number.isSafeInteger(totalCents+lineCents))fail('TOTAL_OVERFLOW','Invalid total');
  totalCents+=lineCents;
  return {productId:id,name:String(product.name||id).slice(0,120),size,quantity:qty,unitPriceCents:product.priceCents,lineTotalCents:lineCents};
 });
 // No client discounts, membership tiers, reward redemption or shipping fees accepted.
 // All such policies require separate server-authorized implementation and approval.
 return {uid:authUid,customer,shippingPhone,gov,address,notes,items,subtotalCents:totalCents,discountCents:0,payableCents:totalCents,shippingCents:null,currency:'EGP',status:'pending',loyaltyAccrued:false};
}
