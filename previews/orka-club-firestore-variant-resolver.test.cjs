'use strict';
const assert=require('node:assert/strict');
const {createFirestoreVariantResolver,createFirestoreCartUnitResolver}=require('./orka-club-firestore-variant-resolver.cjs');
const {cartToCheckoutUnits}=require('./orka-club-cart-variant-adapter.cjs');
const docs={
 'variantMappings/whale':{active:true,variants:[{variantId:'whale-4-navy',size:'4',color:'navy',active:true},{variantId:'whale-6-navy',size:'6',color:'navy',active:false}]}
};
const db={doc(path){return {async get(){return {exists:Object.hasOwn(docs,path),data:()=>docs[path]}}}}};
(async()=>{
 assert.deepEqual(await createFirestoreCartUnitResolver(db)([{productId:'whale',size:'4',color:'navy',qty:2,price:1}]),[{unitId:'line0-unit0',productId:'whale-4-navy'},{unitId:'line0-unit1',productId:'whale-4-navy'}]);
 await assert.rejects(()=>createFirestoreCartUnitResolver(db)([{productId:'whale',size:'14',color:'navy',qty:1}]),/Invalid cart line/);
 await assert.rejects(()=>createFirestoreCartUnitResolver(db)([{productId:'whale',size:'4',color:'navy',qty:51}]),/Invalid cart line/);
 await assert.rejects(()=>createFirestoreCartUnitResolver(db)([{productId:'whale',size:'6',color:'navy',qty:1}]),/Unmapped/);
 const resolveVariantId=await createFirestoreVariantResolver(db)([{productId:'whale',size:'4',color:'navy',qty:1}]);
 assert.deepEqual(cartToCheckoutUnits([{productId:'whale',size:'4',color:'navy',qty:1,price:1}],{resolveVariantId}),[{unitId:'line0-unit0',productId:'whale-4-navy'}]);
 assert.throws(()=>cartToCheckoutUnits([{productId:'whale',size:'6',color:'navy',qty:1}],{resolveVariantId}),/Unmapped/);
 await assert.rejects(()=>createFirestoreVariantResolver(db)([{productId:'missing'}]),/Unmapped/);
 await assert.rejects(()=>createFirestoreVariantResolver(db)([{productId:'../orders'}]),/Invalid product ID/);
 const bad={doc(){return {async get(){return {exists:true,data:()=>({active:true,variants:[{variantId:'../orders',size:'4',color:'navy',active:true}]})}}}}};
 await assert.rejects(()=>createFirestoreVariantResolver(bad)([{productId:'whale'}]),/Invalid trusted variant record/);
 console.log('Server-only Firestore variant mapping resolver tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
