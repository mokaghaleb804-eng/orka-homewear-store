import {normalizeCatalogCart} from './catalog-cart-adapter.mjs';
export function createStorefrontCheckoutPreview({app,quoteOrder,createOrder,readCart}) {
 if(app?.options?.projectId!=='demo-orka-checkout'||app.name!=='orka-emulator-preview') throw Error('المحاكي فقط');
 let accepted=null,busy=false;
 const snapshot=(mode,customer)=>({mode,customer:{name:customer.name,phone:customer.phone,gov:customer.gov,address:customer.address,notes:customer.notes||''},items:normalizeCatalogCart(readCart())});
 async function exclusive(fn){if(busy)throw Error('انتظر انتهاء العملية');busy=true;try{return await fn();}finally{busy=false;}}
 return {
  invalidate(){accepted=null;},
  review(mode,customer){return exclusive(async()=>{accepted=null;const input=snapshot(mode,customer);const quote=await quoteOrder(app,input.mode,input.customer,input.items);if(quote.receipt)return quote;if(!quote.quoteId||!Number.isSafeInteger(quote.totalEGP))throw Error('عرض سعر غير صالح');accepted={input,quote};return quote;});},
  confirm(mode,customer,quoteId){return exclusive(async()=>{const input=snapshot(mode,customer);if(!accepted||accepted.quote.quoteId!==quoteId||JSON.stringify(input)!==JSON.stringify(accepted.input))throw Error('راجع الطلب مجددًا');return createOrder(app,input.mode,input.customer,input.items,quoteId);});}
 };
}
