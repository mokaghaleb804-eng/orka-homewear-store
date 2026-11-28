const test=require('node:test');
const assert=require('node:assert/strict');
const {createAdminShipping}=require('../functions/admin-shipping');
class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
function fixture(role='admin',settings={}) {
 let written;
 const db={doc:p=>p,runTransaction:fn=>fn({get:async p=>({exists:true,data:()=>p.startsWith('admins/')?{role}:settings}),set:(p,d)=>{written=d;}})};
 const run=createAdminShipping({db,HttpsError,FieldValue:{serverTimestamp:()=>123}});
 return {run,get written(){return written;}};
}
const request={auth:{uid:'admin1',token:{firebase:{sign_in_provider:'google.com'}}},data:{gov:'الجيزة',carrierEGP:80,subsidyEGP:30}};
test('admin can save draft and invalidate approval',async()=>{const f=fixture('admin',{shippingEGPByGovernorate:{'القاهرة':70}});const result=await f.run(request);assert.equal(result.shippingEGP,50);assert.equal(f.written.shippingApproved,false);assert.equal(f.written.carrierEGPByGovernorate['القاهرة'],70);});
test('nonadmin cannot write',async()=>{const f=fixture('customer');await assert.rejects(f.run(request),{code:'permission-denied'});assert.equal(f.written,undefined);});
test('enabled checkout blocks draft edits',async()=>{const f=fixture('admin',{enabled:true});await assert.rejects(f.run(request),{code:'failed-precondition'});assert.equal(f.written,undefined);});
test('invalid subsidy rejected',async()=>{const f=fixture();await assert.rejects(f.run({...request,data:{...request.data,subsidyEGP:81}}),{code:'invalid-argument'});});
test('anonymous session rejected',async()=>{const f=fixture();await assert.rejects(f.run({...request,auth:{uid:'x',token:{firebase:{sign_in_provider:'anonymous'}}}}),{code:'permission-denied'});});
