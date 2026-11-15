'use strict';
// Preview-only validation; no customer data is sent to production.
// Delivery PII must only be stored in server-owned order records.
function clean(s,min,max,required=true){
 if(s==null&&!required)return null;
 if(typeof s!=='string'||s!==s.trim()||s.length<min||s.length>max||/[\u0000-\u001f\u007f]/.test(s))throw Error('Invalid delivery field');
 return s;
}
function validateDeliveryDetails(details){
 if(!details||typeof details!=='object'||Array.isArray(details))throw Error('Invalid delivery details');
 const required=['recipientName','phone','governorate','streetAddress','building'];
 const allowed=new Set([...required,'apartment','landmark']);
 if(Object.keys(details).some(k=>!allowed.has(k))||required.some(k=>!(k in details)))throw Error('Unexpected or missing delivery field');
 const phone=clean(details.phone,11,11);
 if(!/^01[0125][0-9]{8}$/.test(phone))throw Error('Invalid Egyptian mobile number');
 return Object.freeze({
  recipientName:clean(details.recipientName,2,100),
  phone,
  governorate:clean(details.governorate,2,80),
  streetAddress:clean(details.streetAddress,5,250),
  building:clean(details.building,1,50),
  apartment:clean(details.apartment,1,50,false),
  landmark:clean(details.landmark,1,150,false)
 });
}
module.exports={validateDeliveryDetails};
