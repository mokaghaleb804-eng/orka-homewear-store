import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const pages=['isolated-preview.html','checkout-preview.html','orders-admin-preview.html'];
const html=Object.fromEntries(pages.map(p=>[p,readFileSync(new URL('../'+p,import.meta.url),'utf8')]));
test('all isolated pages explicitly identify demo mode and prohibit indexing',()=>{
 for(const [name,source] of Object.entries(html)){
  assert.match(source,/noindex,nofollow/i,name);
  assert.match(source,/demo|isolated|preview/i,name);
 }
});
test('isolated preview pages contain no Firebase SDK, external scripts or network submission',()=>{
 for(const [name,source] of Object.entries(html)){
  assert.doesNotMatch(source,/<script[^>]+src\s*=/i,name);
  assert.doesNotMatch(source,/firebase(app|auth|firestore)|firebase\.googleapis|initializeApp\s*\(|getFirestore\s*\(/i,name);
  assert.doesNotMatch(source,/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket)\s*\(/i,name);
 }
});
test('demo checkout stores only item and status metadata, not delivery details',()=>{
 const source=html['checkout-preview.html'];
 assert.match(source,/items:bag\.map\(\(\{id,qty,size\}\)=>\(\{id,qty,size\}\)\)/);
 assert.match(source,/history:\[\{status:'pending',at:createdAt\}\]/);
 assert.doesNotMatch(source,/localStorage\.setItem\([^;]*JSON\.stringify\(values\)/);
 assert.doesNotMatch(source,/sessionStorage\.setItem\([^;]*JSON\.stringify\(values\)/);
});
test('demo checkout and dashboard share same browser-local order key',()=>{
 const checkout=html['checkout-preview.html'],admin=html['orders-admin-preview.html'];
 const key='orka-signature-isolated-v2-demo-orders';
 assert.ok(checkout.includes(key));
 assert.ok(admin.includes(key));
 assert.match(checkout,/Simulated order saved in this browser only/);
});
test('demo admin confirms irreversible transitions and sanitizes spreadsheet formula cells',()=>{
 const source=html['orders-admin-preview.html'];
 assert.match(source,/confirm\('Set demo order /);
 assert.match(source,/\[=\+@-\]/);
 assert.match(source,/text\.replace\(\/"\/g,'""'\)/);
});
