# ORKA secure checkout — implementation contract (DRAFT, NOT DEPLOYED)

This document defines the minimum safe backend before enabling checkout in `index.html`. Do not enable live orders by removing the early return in `submitOrder`. The existing `firestore.rules.proposed` is NOT safe to deploy as-is.

## Server-authoritative catalog

Maintain a trusted catalog in Firestore `catalog/{productId}`, writable only by trusted administrators via a separate privileged workflow, with `active`, `priceEGP` (integer minor units preferred), `sizes`, `name`, `inventoryMode`, `maxPerOrder`. Do not derive price or discount from client cart data. Freeze price, product title, size and quantity in the order snapshot.

## Checkout API contract

Use an authenticated Firebase callable Cloud Function `createOrkaOrder` with enforced App Check and server-side rate limiting. For the initial release require Google/Firebase login; guest checkout must remain off until its abuse controls are designed.

Client submits only:
```json
{
  "requestId": "random-uuid-v4-generated-once-per-checkout-attempt",
  "customer": "Customer name",
  "phone": "01XXXXXXXXX",
  "gov": "Cairo",
  "address": "Delivery address",
  "notes": "",
  "items": [{"productId":"sku-001","size":"6","qty":1}]
}
```
Do NOT accept client-provided totals, prices, loyalty points, status, UID, or timestamps. Treat contact phone as delivery data; never equate it to Firebase Auth verified phone.

Backend:
1. Verify authenticated identity, App Check, size/quantity caps, field lengths, allowed governorates, and per-account request rate. Do not expose customer PII in logs.
2. Read trusted catalog and reject inactive/missing products, invalid variants, and quantity beyond limits.
3. Compute totals, shipping and discounts from server-owned configuration. For the first release, disable reward-credit redemption and loyalty until a fully transactional design is approved.
4. Use a Firestore transaction with deterministic idempotency key derived from `uid + requestId`; reject a reused requestId with a different payload. Use `orders/{orderId}` and store the immutable canonical order and creation timestamp.
5. Return only `orderId` and server-calculated total. Never accept direct client writes to `orders`.
6. Server-only state changes and loyalty awards; delivery must be idempotent and verify valid transition and customer account.

## Rules and rollout gates

- Replace direct `orders` create permission with `allow create: if false` only when the callable function is ready; Admin SDK bypasses Firestore rules.
- Keep customer read restricted to `resource.data.uid == request.auth.uid`, admin read via `admins/{uid}.role == 'admin'`; preserve no client deletes.
- Update customer profile create/update rules to support Google sign-in safely, while prohibiting client edits to points, reward credit, and lifetime spend.
- Test with Firebase emulator: modified price, unknown SKU, invalid size, negative qty, repeated requestId, mismatched payload, concurrent requests, anonymous caller, App Check failure, auth Google account, admin read, customer cross-read, delivery retry, loyalty double-award.
- Confirm deployed Firestore rules (not just repository rules), indexes, Cloud Functions region, billing plan and secrets.
- Deploy backend and verified rules first, run live test with a controlled test SKU, then explicitly approve enabling `submitOrder` on production. No live release without browser/mobile and emulator evidence.

## Existing state

ORKA Orders local TEST lab is functional; it must remain isolated from real sales. `ENABLE_LIVE_DELIVERY=false` is a deliberate safety gate.

**Status:** design only; no production settings, rules, or checkout behavior changed.
