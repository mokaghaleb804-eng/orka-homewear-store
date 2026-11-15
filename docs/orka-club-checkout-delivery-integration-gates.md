# ORKA checkout customer and delivery integration gate (preview only)

Status: **NO-GO** for production. This is an implementation contract, not a deployed API or approved shipping policy.

## Confirmed gaps
- Current preview HTTP request accepts `shippingAddress.zoneId` only. It does not persist a verified recipient name, Egyptian phone number, street address, building, apartment, landmark or governorate.
- A successful quote or order record with only a shipping zone is **not dispatchable**. Do not expose the current handler as a live COD checkout.
- Current checkout requires a verified, non-anonymous Firebase account. Guest ordering requires a separate secure server-side identity and access design.
- `shippingZones/{zoneId}` and `catalog/{productId}` are preview contracts; their production availability and price/variant completeness are not established.
- The browser's legacy `saveOrkaOrder` and legacy loyalty calculations must stay disabled. Never accept client-supplied item prices, discounts, shipping, wallet balances or delivery status.

## Required next implementation gates
1. Define a bounded, server-validated delivery schema: recipient name, phone, governorate/zone, street address, building and optional apartment/landmark; normalize and constrain lengths, reject control characters and unexpected keys. Validate Egyptian phone format with a reviewed country-specific rule.
2. Store delivery PII only in server-owned orders, enforce owner/admin access and minimal retention; do not expose it in wallet ledger or analytics. Define support access and deletion/retention policy.
3. Confirm trusted SKU+size+color IDs, active catalog prices in integer piastres, and active shipping-zone prices. Reject unmapped variants.
4. Require server-owned COD eligibility and a stable idempotency key; test concurrent identical orders, conflicting replay, delivery-field changes, shipping-price changes and retries.
5. Build authenticated checkout and guest checkout as **separate reviewed flows**. Do not give anonymous Firebase users personal wallet credit by default.
6. Integrate the website only behind an explicit preview flag; run end-to-end COD tests before enabling live submissions.
7. Obtain approval of shipping charges, COD handling, returns and wallet-credit reversal before release.

Release decision remains **NO-GO** until all gates are implemented, tested and explicitly approved. No changes to Firebase production, main branch or public checkout are authorized by this document.
