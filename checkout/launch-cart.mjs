import {normalizeCatalogCart} from './catalog-cart-adapter.mjs';
export function reconcileLaunchCart(rawCart,catalog){
 const items=normalizeCatalogCart(rawCart);
 const rows=items.map(item=>{
  const p=catalog[item.productId];
  const price=p?.priceEGPBySize?.[item.size];
  if(!p||p.requiresSizeApproval||!p.sizes.includes(item.size)||!Number.isSafeInteger(price)||price<1)throw Error('الموديل أو المقاس غير متاح');
  return {...item,name:p.name,sku:p.sku,displayUnitPriceEGP:price};
 });
 const subtotalEGP=rows.reduce((sum,p)=>sum+p.qty*p.displayUnitPriceEGP,0);
 return {rows,subtotalEGP,estimatedShippingEGP:80,estimatedTotalEGP:subtotalEGP+80,serverQuoteRequired:true};
}
