import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCatalogCart} from '../checkout/catalog-cart-adapter.mjs';
test('ignores client prices and merges variants',()=>assert.deepEqual(normalizeCatalogCart([{id:12,size:'6',qty:1,price:1},{id:12,size:'6',qty:2,price:0}]),[{productId:'12',size:'6',qty:3}]));
test('rejects invalid cart rows',()=>{for(const row of [{id:'a/b',size:'6',qty:1},{id:'a',size:'',qty:1},{id:'a',size:'6',qty:0},{id:'a',size:'6',qty:11},{id:'a',size:'6',qty:true}])assert.throws(()=>normalizeCatalogCart([row]));});
test('rejects excess duplicate quantities',()=>assert.throws(()=>normalizeCatalogCart([{id:'a',size:'6',qty:6},{id:'a',size:'6',qty:5}])));
test('rejects empty cart',()=>assert.throws(()=>normalizeCatalogCart([])));
