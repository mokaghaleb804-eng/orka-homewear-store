# ORKA CLUB — actual production checkout integration gap (reviewed 2026-11-15)

Status: **BLOCKED — preview only.** Based on `index.html` and `docs/checkout-payment-preview.md` on `main`. No production or Firebase changes.

## Verified existing implementation
- `index.html` has `submitOrder(e)`, but the first executable statements show a demo-only toast and unconditional `return`: **real order submission is currently disabled**.
- Unreachable legacy checkout code calculates totals from browser cart prices, membership tier discounts, and a 2% reward credit. **It is not the proposed ORKA CLUB 10%/30-day wallet policy.**
- `window.saveOrkaOrder` constructs `safeOrder` in the browser and calls `addDoc(collection(db,'orders'),safeOrder)`, passing client-derived prices, totals, loyalty discounts and a nullable `uid`. This is not a trusted server-side checkout and must **not** be re-enabled as-is.
- The new preview backend expects Firestore `catalog/{productId}` with `pricePiastres` and `shippingZones/{zoneId}` with `pricePiastres`. These are **prototype contracts, not verified live collections**.
- The new preview checkout requires verified non-anonymous Firebase identity, while the documented customer experience includes **guest and signed-in checkout**. Guest token/ownership is not implemented.
- The preview checkout contract expects one `unitId` per purchased unit; the existing browser cart uses product names, size, quantity, and EGP prices. A trusted mapping from real product/variant IDs to units and integer piastres is missing.
- Shipping fees, COD eligibility and approved checkout totals are release gates per `docs/checkout-payment-preview.md`. Do not treat demo rates as approved.

## Required integration order
1. **Keep the live checkout disabled** until trusted catalog, shipping matrix and COD terms are approved.
2. Define stable product/variant IDs for actual catalog entries (including size/color), stock availability, and server-side piastre pricing. Migrate cart `qty` into unique per-unit IDs without trusting browser prices.
3. Select a deployed server runtime (Vercel serverless or Firebase Functions) with Firebase Admin credentials stored only server-side; wire the existing HTTP contract to it. Protect against request flooding and token abuse. No production secrets in browser code.
4. Resolve shipping **transactionally**, with server-approved governorate/zone and delivery address, plus COD eligibility. Preserve idempotency on retries and refuse mismatched payloads.
5. Implement a separately secured guest checkout flow or explicitly limit the initial wallet launch to authenticated customers **without silently removing guest purchasing**.
6. Wire a preview-only UI flow to server-generated order ID, validated totals, one eligible wallet unit and transaction-backed redemption. Never submit legacy browser-side loyalty fields.
7. Emulator + staging end-to-end tests: duplicate submissions, concurrent checkout, changed shipping, price/variant tampering, owner spoofing, guest flow, COD, wallet expiry, refunds, mobile Arabic/English. Confirm rules are compatible with real order reads.
8. Review actual deployed Firebase rules and data model, verify Vercel configuration, then obtain explicit release approval. Do not merge or deploy merely because CI is green.

## Important design issue
The shipping resolver now reads through the Firestore transaction when provided. The current HTTP boundary allows only `shippingAddress.zoneId`; this is **not** a full delivery address. Capture and validate contact/address details in a separate trusted schema before production.

## Release verdict
**NO-GO.** The ORKA CLUB branch is a prototype with passing unit/static tests; real checkout integration and security gates remain incomplete.
