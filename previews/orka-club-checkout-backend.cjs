'use strict';
// SERVER-ONLY composition; not a public HTTP route and not production deployed.
// The caller must provide Firebase Admin Auth and Firestore Admin instances.
const {createFirebaseIdentityVerifier}=require('./orka-club-firebase-identity-verifier.cjs');
const {createFirestoreShippingResolver}=require('./orka-club-firestore-shipping-resolver.cjs');
const {createFirestoreTrustedCheckoutService}=require('./orka-club-firestore-checkout-service.cjs');
function createOrkaClubCheckoutBackend({adminAuth,firestore}={}){
 if(!adminAuth||!firestore)throw Error('Firebase Admin services required');
 const verifyIdentity=createFirebaseIdentityVerifier(adminAuth);
 const resolveShipping=createFirestoreShippingResolver(firestore);
 return createFirestoreTrustedCheckoutService(firestore,{verifyIdentity,resolveShipping});
}
module.exports={createOrkaClubCheckoutBackend};
