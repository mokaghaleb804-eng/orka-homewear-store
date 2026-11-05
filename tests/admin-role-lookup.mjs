// Server-only ORKA admin-role lookup. Inject a Firebase Admin Firestore db.
// Do not use client SDK; admins/{uid} must be provisioned by trusted operators.
import {CheckoutError} from './trusted-order-calculator.mjs';
export function createAdminRoleLookup(db){
 if(!db||typeof db.collection!=='function')throw new CheckoutError('INVALID_STORE','Admin Firestore required');
 return async uid=>{
  if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))return false;
  const snap=await db.collection('admins').doc(uid).get();
  return snap.exists===true&&snap.data()?.role==='admin';
 };
}
