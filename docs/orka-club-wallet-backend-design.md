# ORKA CLUB — trusted wallet backend implementation design (NOT deployed)

**Status:** preview design only. No Firebase rules, Functions, live checkout, orders or customer records changed.

## Source-of-truth boundaries
1. A signed-in Firebase Auth UID identifies wallet owner; a checkout phone number is NEVER identity.
2. Trusted order record must contain server-priced unit snapshots, order UID, shipping, discount flags and authoritative delivery event.
3. Only privileged server code can write ledger, wallet credits or redemptions. Client SDK access: owner read-only where appropriate; no client create/update/delete.
4. No credit for guests until an explicit verified account-link policy is approved. Never silently attach by phone.

## Suggested Firestore model (proposal)
- `wallets/{uid}/credits/{creditId}`: grant order ID, earned integer piastres, remaining piastres, issuedAt, expiresAt, reversed flag.
- `wallets/{uid}/events/{eventId}`: immutable grant/redeem/reverse records, order ID, redemption ID, amount, timestamp and causation ID.
- `walletOperations/{operationId}`: unique idempotency result including owner UID, request hash, status and response. Scope unique order events globally, not just per account.
- Keep a dedicated privileged-only order delivery/return event source; do not trust customer-submitted delivery state.

## Atomic transaction contract
**Grant after delivery:** verify trusted delivery, eligible full-price product subtotal and wallet-free order. In one transaction check unique grant event, create credit and event, and persist result. Repeated delivery events return same persisted result. If order ownership changes, fail closed.

**Redeem:** authenticate UID; resolve selected unit and trusted server price; validate one unit only, no stacking, no shipping; read eligible unexpired credits ordered by expiry; atomically decrement credits, create immutable debit events and persist idempotency response. On retry with same ID and request hash, return identical original response. Reusing ID with different payload must fail.

**Return/reversal:** verify privileged return event, original order and original grant. Idempotently reverse unspent granted credit. If already redeemed, record outstanding clawback/debt separately pending approved business policy; never silently mint negative balances. Partial returns must recalculate only returned eligible units. Reversing a redeemed purchase needs a separate restoration policy that respects original credit expiry.

## Required integration and security tests
- Firebase emulator tests for denied client wallet writes and cross-account reads/writes.
- Parallel redemption transactions against same balance; only one may consume it.
- Process restart and multiple instances preserve grants and idempotency.
- Duplicate delivery events, altered replay payload, order reassignment and malicious client prices.
- Partial/full returns before and after spending, expiry at exact boundary, time zone rule.
- Server-authoritative one-unit discount, shipping unaffected, no stacked discounts and no earning on redeemed orders.
- Backward compatibility / migration of legacy points and tiers, with explicit user approval.

## Release decision
BLOCKED until trusted checkout/backend security work, Firestore emulator tests, return policy and migration are complete and reviewed. GitHub Actions success on the isolated in-memory prototype does not approve launch.
