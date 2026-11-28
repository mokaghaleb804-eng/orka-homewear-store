// Only product identifiers, sizes and quantities cross the trust boundary.
export function normalizeCatalogCart(raw) {
 if(!Array.isArray(raw)||!raw.length||raw.length>30) throw Error('السلة غير صالحة');
 const grouped=new Map();
 for(const item of raw){
  if(!item||!['string','number'].includes(typeof item.id)||typeof item.size!=='string'&&typeof item.size!=='number') throw Error('بيانات المنتج غير صالحة');
  const productId=String(item.id).trim(),size=String(item.size).trim(),qty=Number(item.qty);
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(productId)||!size||size.length>40||!['number','string'].includes(typeof item.qty)||!Number.isInteger(qty)||qty<1||qty>10) throw Error('راجع المنتج والمقاس والكمية');
  const key=JSON.stringify([productId,size]),previous=grouped.get(key);
  const total=(previous?.qty||0)+qty;
  if(total>10) throw Error('الكمية أكبر من الحد');
  grouped.set(key,{productId,size,qty:total});
 }
 const items=[...grouped.values()];
 if(items.length>20||items.reduce((sum,x)=>sum+x.qty,0)>30) throw Error('عدد القطع أكبر من الحد');
 return items;
}
