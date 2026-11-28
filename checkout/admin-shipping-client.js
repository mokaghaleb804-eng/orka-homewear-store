// Draft adapter; caller supplies initialized Firebase Functions and httpsCallable.
export function createAdminShippingClient({functions,httpsCallable}) {
  const update=httpsCallable(functions,'updateOrkaShipping');
  return async function saveShipping({gov,carrierEGP,subsidyEGP=0}) {
    if(typeof gov!=='string'||!gov.trim()||![carrierEGP,subsidyEGP].every(v=>Number.isSafeInteger(v)&&v>=0&&v<=10000)||subsidyEGP>carrierEGP) throw new Error('راجع المحافظة ومصاريف الشحن');
    const result=await update({gov,carrierEGP,subsidyEGP});
    return result.data;
  };
}
