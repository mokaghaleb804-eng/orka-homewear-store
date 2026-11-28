const {calculateShipping}=require('./shipping-policy');
function createAdminShipping({db,HttpsError,FieldValue}) {
  return async function updateOrkaShipping(request) {
    const uid=request.auth?.uid;
    if(!uid || request.auth.token.firebase?.sign_in_provider==='anonymous') throw new HttpsError('permission-denied','Admin required');
    const d=request.data;
    const regions=["القاهرة","الجيزة","الإسكندرية","القليوبية","الشرقية","الغربية","المنوفية","الدقهلية","البحيرة","كفر الشيخ","دمياط","بورسعيد","الإسماعيلية","السويس","الفيوم","بني سويف","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","البحر الأحمر","الوادي الجديد","مطروح","شمال سيناء","جنوب سيناء"];
    if(!d || typeof d!=='object' || Array.isArray(d) || Object.keys(d).some(k=>!['gov','carrierEGP','subsidyEGP'].includes(k)) || !regions.includes(d.gov)) throw new HttpsError('invalid-argument','Invalid governorate or fields');
    let price;
    try {price=calculateShipping(d);} catch {throw new HttpsError('invalid-argument','Invalid shipping amounts');}
    return db.runTransaction(async tx=>{
      const admin=await tx.get(db.doc('admins/'+uid));
      const ref=db.doc('storeSettings/checkout');
      const settings=await tx.get(ref);
      if(!admin.exists || admin.data().role!=='admin') throw new HttpsError('permission-denied','Admin required');
      const current=settings.exists?settings.data():{};
      if(current.enabled===true) throw new HttpsError('failed-precondition','Draft changes require checkout disabled');
      const carrier={...(current.carrierEGPByGovernorate||current.shippingEGPByGovernorate||{}),[d.gov]:price.carrierEGP};
      const subsidy={...(current.subsidyEGPByGovernorate||{}),[d.gov]:price.subsidyEGP};
      tx.set(ref,{carrierEGPByGovernorate:carrier,subsidyEGPByGovernorate:subsidy,shippingApproved:false,shippingUpdatedBy:uid,shippingUpdatedAt:FieldValue.serverTimestamp()},{merge:true});
      return {gov:d.gov,...price,shippingApproved:false};
    });
  };
}
module.exports={createAdminShipping};
