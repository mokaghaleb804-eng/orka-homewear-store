// DRAFT candidate only. No deployment authorization.
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {createCheckoutService}=require('./checkout-core');
initializeApp();
const service=createCheckoutService({db:getFirestore(),HttpsError,FieldValue});
const options={region:'me-central1',enforceAppCheck:true,maxInstances:10,timeoutSeconds:30,memory:'256MiB'};
exports.quoteOrkaOrder=onCall(options,service.quoteOrkaOrder);
exports.createOrkaOrder=onCall(options,service.createOrkaOrder);
exports.updateOrkaOrderStatus=onCall(options,service.updateOrkaOrderStatus);
