'use strict';
const assert=require('node:assert/strict');
const {createFirebaseIdentityVerifier}=require('./orka-club-firebase-identity-verifier.cjs');
let revokeChecked=false;
const verifier=createFirebaseIdentityVerifier({verifyIdToken:async(token,checkRevoked)=>{
 revokeChecked=checkRevoked;
 if(token==='valid')return {uid:'alice',firebase:{sign_in_provider:'google.com'}};
 if(token==='anonymous')return {uid:'guest',firebase:{sign_in_provider:'anonymous'}};
 throw Error('Token rejected');
}});
(async()=>{
 assert.deepEqual(await verifier('valid'),{uid:'alice'});
 assert.equal(revokeChecked,true);
 await assert.rejects(verifier('anonymous'),/Authenticated account required/);
 await assert.rejects(verifier('invalid'),/Token rejected/);
 await assert.rejects(verifier(''),/Missing Firebase ID token/);
 assert.throws(()=>createFirebaseIdentityVerifier({}),/Firebase Admin Auth required/);
 console.log('Firebase Admin identity verification contract passed');
})().catch(e=>{console.error(e);process.exitCode=1});
