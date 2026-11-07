# ORKA secure checkout — implementation contract (DRAFT, NOT DEPLOYED)

This document defines the minimum safe backend before enabling checkout in `index.html`. Do not enable live orders by removing the early return in `submitOrder`. The existing `firestore.rules.proposed` is NOT safe to deploy as-is.

## Server-authoritative catalog

Maintain a trusted catalog in Firestore `catalog/{productId}`, writable only by trusted administrators via a separate privileged workflow, with `active`, `priceEGP` (integer minor units preferred), `sizes`, `name`, `inventoryMode`, `maxPerOrder`. Do not derive price or discount from client cart data. Freeze price, product title, size and quantity in the order snapshot.

## Checkout API contract

Use an authenticated Firebase callable Cloud Function `createOrkaOrder` with enforced App Check and server-side rate limiting. Support both registered checkout (Google/Firebase Auth) and guest checkout. Guest must not require a visible sign-in step. Use Firebase anonymous auth under the hood only if approved and enabled, with App Check and abuse controls; alternatively use a server-issued guest session with equivalent safeguards. Never trust a guest-provided UID, phone, or claimed account ownership. Guest orders must not grant loyalty credit until a verified, consented account-linking flow is completed.

Client submits only:
```json
{
  "requestId": "random-uuid-v4-generated-once-per-checkout-attempt",
  "checkoutMode": "registered",
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
1. Verify identity/session and checkoutMode (registered or guest), App Check, size/quantity caps, field lengths, allowed governorates, and per-account/IP/device abuse limits. Do not expose customer PII in logs. Guest phone is a contact number, not a verified account credential.
2. Read trusted catalog and reject inactive/missing products, invalid variants, and quantity beyond limits.
3. Compute totals, shipping and discounts from server-owned configuration. For the first release, disable reward-credit redemption and loyalty until a fully transactional design is approved.
4. Use a Firestore transaction with deterministic idempotency key derived from authenticated UID or server-issued guest session ID plus requestId; reject a reused requestId with a different payload. Use `orders/{orderId}` and store the immutable canonical order and creation timestamp.
5. Return only `orderId` and server-calculated total. Never accept direct client writes to `orders`.
6. Server-only state changes and loyalty awards; delivery must be idempotent and verify valid transition and customer account.

## Rules and rollout gates

- Replace direct `orders` create permission with `allow create: if false` only when the callable function is ready; Admin SDK bypasses Firestore rules.
- Keep customer read restricted to `resource.data.uid == request.auth.uid`, admin read via `admins/{uid}.role == 'admin'`; preserve no client deletes.
- Update customer profile create/update rules to support Google sign-in safely, while prohibiting client edits to points, reward credit, and lifetime spend.
- Test with Firebase emulator: modified price, unknown SKU, invalid size, negative qty, repeated requestId, mismatched payload, concurrent requests, Google account, guest anonymous/session, guest impersonation, rate limits, App Check failure, admin read, customer cross-read, delivery retry, loyalty double-award.
- Guest orders must be accessible to admin only; a guest must not retrieve other guest orders by phone or order number alone. Provide confirmation receipt ID, and optionally secure order tracking with a short-lived server-issued token. Explicitly separate guest orders from registered customer account/loyalty records.
- Confirm deployed Firestore rules (not just repository rules), indexes, Cloud Functions region, billing plan and secrets.
- Deploy backend and verified rules first, run live test with a controlled test SKU, then explicitly approve enabling `submitOrder` on production. No live release without browser/mobile and emulator evidence.

## Existing state

ORKA Orders local TEST lab is functional; it must remain isolated from real sales. `ENABLE_LIVE_DELIVERY=false` is a deliberate safety gate.

**Status:** design only; no production settings, rules, or checkout behavior changed.
