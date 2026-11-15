'use strict';
// Preview-only pure calculations. NOT a trusted backend or production wallet ledger.
const DAY = 24*60*60*1000;
function money(value){if(!Number.isSafeInteger(value)||value<0)throw Error('Amounts must be nonnegative integer piastres');return value}
function earn(fullPriceSubtotalPiastres){return Math.round(money(fullPriceSubtotalPiastres)/10)}
function grant({id,amount,issuedAt}){money(amount);const date=Date.parse(issuedAt);if(!id||!Number.isFinite(date))throw Error('Invalid credit');return {id,remaining:amount,issuedAt:new Date(date).toISOString(),expiresAt:new Date(date+30*DAY).toISOString()}}
function redeem({credits,pricePiastres,now}){money(pricePiastres);const at=Date.parse(now);if(!Number.isFinite(at))throw Error('Invalid time');const copies=credits.map(x=>({...x}));const eligible=copies.filter(x=>money(x.remaining)>0&&Date.parse(x.expiresAt)>at).sort((a,b)=>Date.parse(a.expiresAt)-Date.parse(b.expiresAt)||String(a.id).localeCompare(String(b.id)));let needed=pricePiastres;const debits=[];for(const c of eligible){if(!needed)break;const taken=Math.min(needed,c.remaining);c.remaining-=taken;needed-=taken;debits.push({creditId:c.id,amount:taken})}return {credits:copies,discount:pricePiastres-needed,due:needed,debits}}
module.exports={earn,grant,redeem};
