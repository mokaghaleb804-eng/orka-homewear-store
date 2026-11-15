'use strict';
const assert=require('node:assert/strict');
const {createTrustedVariantResolver,trustedCartToCheckoutUnits}=require('./orka-club-trusted-variant-registry.cjs');
const records=[
 {productId:'whale',variantId:'whale-4-navy',size:'4',color:'navy',active:true},
 {productId:'whale',variantId:'whale-6-navy',size:'6',color:'navy',active:false}
];
const cart=[{productId:'whale',size:'4',color:'navy',qty:2,price:1,discount:999}];
assert.deepEqual(trustedCartToCheckoutUnits(cart,records),[
 {unitId:'line0-unit0',productId:'whale-4-navy'},
 {unitId:'line0-unit1',productId:'whale-4-navy'}
]);
assert.throws(()=>trustedCartToCheckoutUnits([{productId:'whale',size:'6',color:'navy',qty:1}],records),/Unmapped/);
assert.throws(()=>trustedCartToCheckoutUnits([{productId:'whale',size:'4',color:'red',qty:1}],records),/Unmapped/);
assert.throws(()=>createTrustedVariantResolver([...records,records[0]]),/Duplicate/);
assert.throws(()=>createTrustedVariantResolver([{...records[0],variantId:'../orders'}]),/Invalid/);
assert.throws(()=>createTrustedVariantResolver([{...records[0],size:'14'}]),/Invalid/);
assert.equal(createTrustedVariantResolver(records)({productId:'whale',size:'4',color:'navy'}),'whale-4-navy');
console.log('Trusted ORKA catalog variant registry tests passed');
