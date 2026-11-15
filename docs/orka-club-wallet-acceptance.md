# ORKA CLUB wallet — preview-only acceptance contract

Status: PROPOSED / NOT DEPLOYED. No production, Firebase, checkout or customer-data changes authorized by this PR.

## Proposed business rules
- Replace cumulative 5%, 7.5%, 10% membership discounts and old points with wallet credit.
- Eligible delivered full-price orders earn 10% of eligible product subtotal (exclude shipping).
- Credit issued only after authoritative confirmed delivery, once per order (idempotent).
- Each credit has its own 30-day expiry; debit earliest-expiring available credit first.
- Wallet belongs to authenticated account owner only; no transfer, gift or cash-out.
- Redeem up to 100% of one selected unit's current trusted price per order; never against shipping.
- Remaining credit persists with original expiry; never reset expiry on redemption.
- Orders redeeming wallet credit earn zero new credit; no discount stacking.
- Cancellations and returns reverse earned credit and reconcile spent credit; do not allow negative available balance without explicit debt policy.
- Server must compute trusted product prices, discounts, eligible units, and delivery status. No client writes to wallet ledger or checkout totals.
- Money should use integer minor units, explicit rounding rules and immutable audit entries.
- Existing customers' legacy balances require an approved migration/retirement policy; do not silently erase.
- Guest checkout cannot accumulate a personal wallet unless account identity is verified and linked safely.

## Release gates (must pass before implementation approval)
1. Confirm source of truth for delivery and returns, order identity, product catalog and pricing.
2. Resolve legacy discount/points migration, eligibility for partial discounts, refund debt, expiry boundary and time zone.
3. Server-side atomic ledger: grant/redeem/reverse idempotency, concurrency and ownership authorization.
4. Test: 1,000 purchase -> 100 credit; 3,000 -> 300; 1,000 wallet and 800 item -> 800 debit and 200 remaining.
5. Test: two orders racing for same wallet, retries, guest spoofing, partial return, expired credit, one-unit-only, free item shipping, no stacking, no new earnings on redemption.
6. Firebase emulator security-rule tests, CI, no-live-loyalty release gate and review of current published rules.
7. Separate explicit approval before any merge, Firebase update, public preview deployment or production rollout.

The HTML previews are static examples only; their calculations are not trusted checkout logic.

## Prototype limitations discovered during review (blocking)
- In-memory idempotency does NOT survive process restarts, concurrent requests or multiple server instances. Must use durable database transactions and unique order/redemption IDs.
- Prototype `delivered` accepts a caller-supplied delivery flag, price and account ID; it must never be exposed as an API. Production must derive these from verified order records and authenticated session.
- Duplicate order IDs across accounts, account reassignment, return reversals, debt reconciliation and redemption retry responses are NOT implemented.
- Expiration is currently 30 x 24 hours from timestamp; business must confirm whether this means elapsed hours or local calendar dates.
- Pure calculator and in-memory tests are only test cases added to repository, not evidence that GitHub Actions or emulator tests have passed.
- Before production, require atomic ledger with audit trail, concurrency tests, owner checks, immutable price snapshots, authenticated fulfillment status and refund handling.
