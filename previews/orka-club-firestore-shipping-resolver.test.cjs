'use strict';
const assert=require('node:assert/strict');
const {createFirestoreShippingResolver}=require('./orka-club-firestore-shipping-resolver.cjs');
const zones=new Map([['shippingZones/giza',{active:true,pricePiastres:6000}],['shippingZones/off',{active:false,pricePiastres:1000}],['shippingZones/bad',{active:true,pricePiastres:-1}]]);
const db={doc:path=>({get:async()=>({exists:zones.has(path),data:()=>zones.get(path)})})};
(async()=>{
 const resolve=createFirestoreShippingResolver(db);
 assert.equal(await resolve({address:{zoneId:'giza',pricePiastres:1}}),6000);
 await assert.rejects(resolve({address:{zoneId:'../orders'}}),/Invalid shipping zone/);
 await assert.rejects(resolve({address:{zoneId:'missing'}}),/unavailable/);
 await assert.rejects(resolve({address:{zoneId:'off'}}),/inactive or invalid/);
 await assert.rejects(resolve({address:{zoneId:'bad'}}),/inactive or invalid/);
 console.log('Trusted Firestore shipping zone tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
