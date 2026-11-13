'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('checkout-preview.html','utf8');
const store=fs.readFileSync('index.html','utf8');
const config=JSON.parse(fs.readFileSync('checkout-preview.config.json','utf8'));
const checks=[
 ['preview explicitly disabled',()=>{assert.equal(config.environment,'preview-only');assert.equal(config.paymentsEnabled,false);assert.equal(config.orderSubmissionEnabled,false)}],
 ['shipping rates not invented',()=>{assert.deepEqual(config.shipping.rates,[]);assert.equal(config.shipping.status,'awaiting-approved-rates')}],
 ['official ORKA logo',()=>assert.match(html,/orka_logo_transparent\.png/)],
 ['shared cart storage key',()=>{assert.match(html,/localStorage\.getItem\('orka-cart'\)/);assert.match(store,/localStorage\.setItem\('orka-cart'/)}],
 ['cart preview shows size and quantity',()=>{assert.match(html,/String\(x\.size\)/);assert.match(html,/Number\(x\.qty\)/)}],
 ['cart images restricted to same origin',()=>assert.match(html,/url\.origin===location\.origin/)],
 ['preview order button disabled',()=>assert.match(html,/type="button" disabled data-i18n="submit"/)],
 ['online payment disabled',()=>assert.match(html,/name="payment" disabled/)],
 ['form never submits',()=>assert.match(html,/addEventListener\('submit',e=>e\.preventDefault\(\)\)/)],
 ['existing store submission guarded',()=>assert.match(store,/إرسال الطلبات الحقيقية معطّل\.?'\); return;/)],
 ['preview cart link present',()=>assert.match(store,/previewLink\.href='checkout-preview\.html'/)],
 ['demo cart does not mutate real storage',()=>{const segment=html.split('const demoItems=')[1].split('function renderPreviewCart')[0];assert.doesNotMatch(segment,/localStorage\.setItem|fetch\(|XMLHttpRequest/)}],
 ['phone validation',()=>assert.match(html,/01\[0125\]\[0-9\]\{8\}/)],
 ['billing mode toggle',()=>{assert.match(html,/name="billingMode"/);assert.match(html,/billingDetails/)}],
 ['mobile payment icons single row',()=>assert.match(html,/\.payment-logos\{display:flex;flex-wrap:nowrap/)],
 ['no real order or payment endpoints in preview',()=>{assert.doesNotMatch(html,/(?:fetch\s*\(|XMLHttpRequest|sendBeacon\s*\()/);}]
];
let failures=0;
for(const [name,run] of checks){try{run();console.log('PASS',name)}catch(e){failures++;console.error('FAIL',name,e.message)}}
console.log(checks.length-failures+'/'+checks.length+' checks passed');
if(failures)process.exitCode=1;
