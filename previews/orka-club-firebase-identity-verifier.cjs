'use strict';
// SERVER-ONLY: pass a Firebase Admin Auth instance, never a client SDK.
// Reject revoked sessions and anonymous sign-in; no email/phone verification policy yet.
function createFirebaseIdentityVerifier(adminAuth){
 if(!adminAuth||typeof adminAuth.verifyIdToken!=='function')throw Error('Firebase Admin Auth required');
 return async function verifyIdentity(idToken){
  if(typeof idToken!=='string'||!idToken||idToken.length>8192)throw Error('Missing Firebase ID token');
  const decoded=await adminAuth.verifyIdToken(idToken,true);
  if(!decoded||typeof decoded.uid!=='string'||!decoded.uid||decoded.firebase?.sign_in_provider==='anonymous')throw Error('Authenticated account required');
  return {uid:decoded.uid};
 };
}
module.exports={createFirebaseIdentityVerifier};
