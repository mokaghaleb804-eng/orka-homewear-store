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
