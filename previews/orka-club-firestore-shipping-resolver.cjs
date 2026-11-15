'use strict';
// SERVER ONLY. Shipping rates are read from Firestore Admin, never the browser.
// shippingAddress must carry a zoneId selected from the published service areas.
function validId(x){return typeof x==='string'&&x.length>0&&x.length<=128&&x!=='.'&&x!=='..'&&!x.includes('/')&&!x.includes('\\')&&!/[\u0000-\u001f]/.test(x)}
function createFirestoreShippingResolver(db){
 if(!db||typeof db.doc!=='function')throw Error('Firestore Admin required');
 return async function resolveShipping({address,transaction}={}){
  if(!address||!validId(address.zoneId))throw Error('Invalid shipping zone');
  const ref=db.doc('shippingZones/'+address.zoneId);
  const snap=transaction?await transaction.get(ref):await ref.get();
  if(!snap.exists)throw Error('Shipping zone unavailable');
  const zone=snap.data();
  if(!zone||zone.active!==true||!Number.isSafeInteger(zone.pricePiastres)||zone.pricePiastres<0)throw Error('Shipping zone inactive or invalid');
  return zone.pricePiastres;
 };
}
module.exports={createFirestoreShippingResolver};
