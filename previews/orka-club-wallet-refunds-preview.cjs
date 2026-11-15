'use strict';
// Preview-only refund reconciliation. No production writes.
// Revoke unspent grant first; spent amounts are reported as recovery exposure.
// Never mint negative credit or restore expired credit.
function reconcileGrantReturn({credits,grantId,returnedEligiblePiastres,originalEligiblePiastres}){
 for(const n of [returnedEligiblePiastres,originalEligiblePiastres])if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid amount');
 if(!originalEligiblePiastres||returnedEligiblePiastres>originalEligiblePiastres)throw Error('Invalid return ratio');
 const copies=credits.map(c=>({...c}));
 const c=copies.find(x=>x.id===grantId);
 if(!c)throw Error('Unknown grant');
 if(!Number.isSafeInteger(c.originalAmount)||c.originalAmount<0||!Number.isSafeInteger(c.remaining)||c.remaining<0||c.remaining>c.originalAmount)throw Error('Invalid grant state');
 // Cumulative returned subtotal must be supplied from trusted return records.
 const previous=c.returnedEligiblePiastres||0;
 if(!Number.isSafeInteger(previous)||previous<0||previous>returnedEligiblePiastres)throw Error('Non-monotonic return');
 const target=Math.round(c.originalAmount*returnedEligiblePiastres/originalEligiblePiastres);
 const priorRevoked=c.revokedPiastres||0;
 const priorExposure=c.recoveryExposurePiastres||0;
 const already=priorRevoked+priorExposure;
 if(target<already)throw Error('Return reversal conflict');
 const delta=target-already;
 const revoked=Math.min(delta,c.remaining);
 c.remaining-=revoked;c.revokedPiastres=priorRevoked+revoked;
 c.recoveryExposurePiastres=priorExposure+delta-revoked;
 c.returnedEligiblePiastres=returnedEligiblePiastres;
 return {credits:copies,revokedPiastres:revoked,newExposurePiastres:delta-revoked,totalExposurePiastres:c.recoveryExposurePiastres};
}
module.exports={reconcileGrantReturn};
