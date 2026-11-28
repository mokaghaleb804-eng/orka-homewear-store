import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconcileLaunchCart} from '../checkout/launch-cart.mjs';
const {catalog}=JSON.parse(readFileSync(new URL('../config/catalog-launch-draft.json',import.meta.url),'utf8'));
test('local price ignored; approved size price and one shipping charge',()=>{
 const r=reconcileLaunchCart([{id:101,size:'6',qty:1,price:1},{id:108,size:'8',qty:2,price:1}],catalog);
 assert.equal(r.subtotalEGP,1790);assert.equal(r.estimatedTotalEGP,1870);assert.equal(r.serverQuoteRequired,true);
});
test('unavailable size and unknown model rejected',()=>{
 for(const row of [{id:111,size:'2',qty:1},{id:999,size:'6',qty:1}])assert.throws(()=>reconcileLaunchCart([row],catalog));
});
