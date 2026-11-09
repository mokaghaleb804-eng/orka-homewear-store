# ORKA catalog — NOT APPROVED FOR SALES

## Confirmed launch decisions

- COD only; Google registered checkout and secure guest checkout.
- All Egyptian governorates are intended coverage, subject to approved fees/service.
- Preparation takes 3–5 days BEFORE carrier transit.
- Final product prices, carrier agreement and shipping fees remain unresolved.
- Real product photographs and the official customer-service contact require approval.

## Catalog contract

The first candidate supports `inventoryMode: "made-to-order"` only. It does not reserve stock or integrate a carrier. Each authoritative `catalog/{productId}` record requires `active`, a nonempty `name` (max 100 characters), positive safe integer `priceEGP`, valid `sizes`, and integer `maxPerOrder` (1–30). The quantity limit applies across sizes of the same product. Monetary values in this candidate are whole Egyptian pounds; fractional pricing requires a reviewed contract change before provisioning.

Production `index.html` still uses placeholder numeric IDs, prices and size labels. Do not copy these to the authoritative catalog. Approve explicit mappings to stable `productId` and exact size codes for every real model. Real cart / product-page migration is a release blocker, separate from the synthetic demo mapping.

## Amount confirmation

`quoteOrkaOrder` produces a five-minute server-owned quote bound to authenticated UID and canonical input, including the attempt ID, address and items. The browser must display merchandise, shipping and total, then submit the same `quoteId` after explicit confirmation. `createOrkaOrder` rechecks the current catalog, availability, policy, quantities and amount in its Firestore transaction. Changed terms or expired quotes require another confirmation. Successful retries return the original order even after a quote expires or new-order intake is disabled.

## No activation yet

Do not create or enable production `storeSettings/checkout`. New quotes/orders require `enabled`, `catalogApproved`, `shippingApproved`, `abuseControlsApproved` all explicitly true, `paymentMethod: "cod"`, and a valid approved fee for the selected governorate. The abuse approval flag is a gate, NOT an implementation of IP/device limits. Per-UID throttling alone is insufficient for public guest checkout.

## Tests and release blockers

Local Firestore/Auth emulator and loopback callable tests cover pricing, shipping, stale quotes, canonical idempotency, simultaneous retries, identity, ownership, profile protection, admin state transitions and zero loyalty mutations. See `secure-checkout-test-evidence.md` for exact evidence and limitations.

Before release: approve the real catalog/fees, map the real storefront, review deployed rules and legacy data, verify real Google OAuth/Anonymous Auth/App Check, implement and verify network/device abuse controls, run real mobile/browser staging tests, and approve a controlled production rollout. The emulator demo cannot authorize or enable any live service.
