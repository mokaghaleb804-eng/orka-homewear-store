const test = require('node:test');
const assert = require('node:assert/strict');
const {calculateShipping} = require('../functions/shipping-policy');
test('full customer shipping',()=>assert.deepEqual(calculateShipping({carrierEGP:80}),{carrierEGP:80,subsidyEGP:0,shippingEGP:80}));
test('partial subsidy',()=>assert.equal(calculateShipping({carrierEGP:80,subsidyEGP:30}).shippingEGP,50));
test('full subsidy',()=>assert.equal(calculateShipping({carrierEGP:80,subsidyEGP:80}).shippingEGP,0));
test('invalid amounts fail closed',()=>{for(const input of [{carrierEGP:-1},{carrierEGP:1.5},{carrierEGP:80,subsidyEGP:81},{carrierEGP:'80'},{carrierEGP:80,subsidyEGP:-1},{}]) assert.throws(()=>calculateShipping(input),RangeError);});
