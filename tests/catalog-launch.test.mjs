import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../catalog/orka-kids-launch-draft.json',import.meta.url),'utf8'));
const products=data.products;
test('ORKA launch draft contains exactly ten unique models',()=>{
 assert.equal(products.length,10);
 assert.equal(new Set(products.map(p=>p.id)).size,10);
 assert.deepEqual(products.map(p=>p.id),Array.from({length:10},(_,i)=>'look-'+String(i+1).padStart(2,'0')));
});
test('no unapproved draft is marked published',()=>{
 for(const p of products){
  assert.equal(p.status,'draft');
  assert.equal(p.published,false);
  assert.equal(p.priceEGP,null);
  assert.deepEqual(p.images,[]);
 }
});
test('a published product must pass all launch data requirements',()=>{
 const isReady=p=>p.status==='approved'&&p.published===true&&
  Number.isSafeInteger(p.priceEGP)&&p.priceEGP>0&&
  Array.isArray(p.images)&&p.images.length>0&&
  p.images.every(x=>typeof x==='string'&&x.trim().length>0)&&
  Array.isArray(p.sizes)&&p.sizes.length>0&&
  Number.isInteger(p.leadTimeDays)&&p.leadTimeDays>0&&
  typeof p.description==='string'&&p.description.trim().length>0;
 assert.equal(products.filter(isReady).length,0);
 assert.equal(isReady({...products[0],status:'approved',published:true,priceEGP:850,images:['/approved-photo.jpg'],sizes:['7-8Y'],leadTimeDays:5,description:'Approved product details'}),true);
 assert.equal(isReady({...products[0],status:'approved',published:true}),false);
});
