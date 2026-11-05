// ORKA V2: pure, Firebase-free order validation helpers. Not wired to production checkout.
// Amounts and loyalty must be recalculated by a trusted backend before accepting orders.
export function normalizeEgyptPhone(value) {
  let digits=String(value??'').replace(/\D/g,'');
  if(digits.startsWith('0020')) digits=digits.slice(2);
  if(/^01[0125]\d{8}$/.test(digits)) return '+2'+digits;
  if(/^201[0125]\d{8}$/.test(digits)) return '+'+digits;
  throw new Error('Invalid Egyptian mobile number');
}
export function validateCheckout(input) {
  const name=String(input?.name??'').trim();
  const governorate=String(input?.governorate??'').trim();
  const address=String(input?.address??'').trim();
  const phone=normalizeEgyptPhone(input?.shippingPhone);
  if(name.length<2||name.length>80) throw new Error('Invalid customer name');
  if(!governorate||governorate.length>60) throw new Error('Invalid governorate');
  if(address.length<8||address.length>500) throw new Error('Invalid delivery address');
  if(!Array.isArray(input?.items)||!input.items.length||input.items.length>30) throw new Error('Invalid items');
  const items=input.items.map(item=>{
    const productId=String(item?.productId??'').trim();
    const size=String(item?.size??'').trim();
    const quantity=Number(item?.quantity);
    if(!productId||!size||!Number.isInteger(quantity)||quantity<1||quantity>20) throw new Error('Invalid item');
    return {productId,size,quantity};
  });
  return {name,shippingPhone:phone,governorate,address,items};
}
export function makeOrderDraft(authUser,checkout) {
  const clean=validateCheckout(checkout);
  return {customerUid:authUser?.uid||null,...clean,status:'draft'};
}
// Never accept price, payableTotal, discount, points or customerUid from client form data.
