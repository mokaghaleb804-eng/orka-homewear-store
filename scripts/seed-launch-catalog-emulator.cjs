const {initializeApp}=require('../functions/node_modules/firebase-admin/app');
const {getFirestore}=require('../functions/node_modules/firebase-admin/firestore');
const draft=require('../config/catalog-launch-draft.json');
const shipping=require('../config/shipping-launch-draft.json');
async function main(){
 const host=process.env.FIRESTORE_EMULATOR_HOST;
 if(!host||! /^(localhost|127\.0\.0\.1):\d+$/.test(host))throw Error('Local Firestore emulator required');
 const projectId='demo-orka-checkout';
 const db=getFirestore(initializeApp({projectId}));
 const batch=db.batch();
 for(const [id,p] of Object.entries(draft.catalog)){
  if(p.requiresSizeApproval||!p.sizes.length||p.sizes.some(s=>!Number.isSafeInteger(p.priceEGPBySize[s])||p.priceEGPBySize[s]<1))throw Error('Invalid catalog '+id);
  batch.set(db.doc('catalog/'+id),{name:p.name,sku:p.sku,sizes:p.sizes,priceEGPBySize:p.priceEGPBySize,inventoryMode:'made-to-order',active:true,maxPerOrder:10});
 }
 console.log('Emulator only: temporary maximum 10 per model; production limits not approved.');
 await batch.commit();
 console.log('Seeded '+Object.keys(draft.catalog).length+' catalog products. Shipping draft: '+Object.keys(shipping.carrierEGPByGovernorate).length+' governorates. Checkout policy unchanged.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
