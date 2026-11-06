import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const checkout=fs.readFileSync(new URL('../checkout-preview.html',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../orders-admin-preview.html',import.meta.url),'utf8');
test('checkout and admin share the same browser-local demo orders key',()=>{
 const key='orka-signature-isolated-v2-demo-orders';
 assert.ok(checkout.includes(key));
 assert.ok(admin.includes(key));
 assert.match(checkout,/orders\.unshift\(\{id,createdAt,status:'pending'/);
 assert.match(admin,/const allowed=\{pending:\['confirmed','cancelled'\]/);
});
test('checkout retains concise delivery fields and requires details before demo order',()=>{
 for(const id of ['name','phone','gov','area','address'])assert.match(checkout,new RegExp('id="'+id+'"'));
 for(const removed of ['street','building','landmark'])assert.doesNotMatch(checkout,new RegExp('id="'+removed+'"'));
 assert.match(checkout,/getDemoAddress\(\)\.details\.length>=8/);
 assert.match(checkout,/getDemoAddress\(\)\.area\.length>=2/);
});
test('both demo pages disclose local-only mode and avoid real Firebase SDK',()=>{
 assert.match(checkout,/DEMO ONLY/);
 assert.match(admin,/TEST DATA ONLY/);
 for(const html of [checkout,admin]){
  assert.doesNotMatch(html,/firebase-app|firebase-auth|firebase-firestore|firebase\.googleapis\.com/i);
  assert.doesNotMatch(html,/fetch\s*\(/);
 }
});
test('demo admin provides lifecycle and history',()=>{
 for(const state of ['pending','confirmed','preparing','shipped','delivered','cancelled'])assert.ok(admin.includes(state));
 assert.match(admin,/order\.history\.push/);
 assert.match(admin,/View demo admin dashboard|Create a demo order/);
});

test('demo admin shows model lines and total pieces per order',()=>{
 assert.match(admin,/order\.items\.length\+' model line\(s\) · '\+totalQty/);
 assert.match(admin,/totalQty=order\.items\.reduce/);
});

test('demo admin can copy an order ID without sending it to a server',()=>{
 assert.match(admin,/navigator\.clipboard\.writeText\(order\.id\)/);
 assert.match(admin,/Copy order ID/);
});

test('simulated submission enforces bounded names, quantities and valid sizes',()=>{
 assert.match(checkout,/values\.name\.length<=80/);
 assert.match(checkout,/bag\.length<=30/);
 assert.match(checkout,/sizes\.includes\(x\.size\)/);
 assert.match(checkout,/x\.qty<=20/);
 assert.match(checkout,/values\.address\.length<=500/);
});

test('checkout does not save personal delivery fields to demo order storage',()=>{
 const saved=checkout.match(/orders\.unshift\(\{id,createdAt,status:'pending',[\s\S]*?\}\);try\{localStorage\.setItem\(orderKey/);
 assert.ok(saved,'demo order storage call must be present');
 for(const field of ['name:values.name','phone:values.phone','address:values.address','gov:values.gov']){
  assert.ok(!saved[0].includes(field),'delivery details must not be persisted');
 }
});
test('demo admin protects final statuses from further changes',()=>{
 assert.match(admin,/delivered:\[\],cancelled:\[\]/);
 assert.match(admin,/This final status cannot be reversed/);
});

test('demo pages are excluded from search indexing',()=>{
 for(const html of [checkout,admin])assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
});
test('demo admin escapes spreadsheet formulas in exported CSV',()=>{
 assert.match(admin,/function csvCell\(value\)/);
 assert.match(admin,/text="'"+text/);
 assert.match(admin,/replace\(\/"\/g,'""'\)/);
});
test('demo admin renders user-controlled fields as text rather than HTML',()=>{
 assert.doesNotMatch(admin,/\.innerHTML\s*=/);
 assert.match(admin,/\.textContent\s*=/);
});
