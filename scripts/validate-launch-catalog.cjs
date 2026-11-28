const fs=require('node:fs');
const path=require('node:path');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../config/catalog-launch-draft.json'),'utf8'));
const shipping=JSON.parse(fs.readFileSync(path.join(__dirname,'../config/shipping-launch-draft.json'),'utf8'));
const issues=[];
const skus=new Set();
for(const [id,p] of Object.entries(draft.catalog)){
 if(!p.sku||skus.has(p.sku))issues.push(id+': invalid or duplicate SKU');
 skus.add(p.sku);
 if(!p.sizes.length||p.requiresSizeApproval)issues.push(id+' '+p.name+': sizes require approval');
 for(const size of p.sizes)if(!Number.isSafeInteger(p.priceEGPBySize[size])||p.priceEGPBySize[size]<=0||p.priceEGPBySize[size]!==draft.priceGroups[p.priceGroup]?.[size])issues.push(id+': invalid price for '+size);
 if(!Number.isInteger(p.maxPerOrder)||p.maxPerOrder<1||p.maxPerOrder>30)issues.push(id+': quantity limit requires approval');
 if(p.active!==true)issues.push(id+': inactive');
}
if(draft.catalogApproved!==true)issues.push('Catalog not approved');
if(Object.keys(shipping.carrierEGPByGovernorate).length!==27||Object.values(shipping.carrierEGPByGovernorate).some(x=>x!==80))issues.push('Shipping tariff differs from initial approved configuration');
if(shipping.shippingApproved!==true)issues.push('Shipping service verification pending');
console.log(JSON.stringify({ready:issues.length===0,products:Object.keys(draft.catalog).length,issues},null,2));
if(issues.length)process.exitCode=1;
