// Draft helper: no live rates or deployment changes.
function calculateShipping({carrierEGP, subsidyEGP=0}) {
  for (const value of [carrierEGP, subsidyEGP]) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 10000)
      throw new RangeError('Invalid shipping amount');
  }
  if (subsidyEGP > carrierEGP) throw new RangeError('Subsidy exceeds carrier fee');
  return {carrierEGP, subsidyEGP, shippingEGP: carrierEGP - subsidyEGP};
}
module.exports = {calculateShipping};
