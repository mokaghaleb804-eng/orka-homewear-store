# Checkout preview acceptance tests

## Current implementation status
- Standalone bilingual checkout preview exists at `checkout-preview.html`.
- Existing store cart is read-only in preview if same-origin localStorage contains `orka-cart`.
- Payment choices and checkout submission are disabled.
- `checkout-preview.config.json` is fail-closed and not a production feature flag.
- No live backend, payment gateway, shipping integration, or hosted preview was created.

## Manual UI tests
1. Open preview with empty localStorage: empty-cart text; no submission.
2. Add cart entries via existing store on the same origin: names, size, quantity visible; never claim totals are verified.
3. Corrupt localStorage: preview remains usable and no data is transmitted.
4. Toggle English/Arabic: direction and all labelled sections update.
5. Enter customer details: no form submission, no network checkout call.
6. Online radio remains disabled; COD is informational only.
7. Mobile width 320px: no horizontal overflow; fields readable.
8. Validate no real logo alteration; preview text uses ORKA brand wordmark, not a substitute for official image.

## Future integration tests (not yet implemented)
- Backend rejects missing catalog price, manipulated unit price, invalid product, unsupported size, negative quantity, and duplicate idempotency keys.
- Server rejects unapproved shipping region/rate and coupon; cannot place order without exact final total.
- Guest and signed-in order permissions, race conditions and stock reservations.
- Payment sandbox: success, decline, cancellation, timeout, webhook replay, forged signature, wrong amount/currency, out-of-order callbacks.
- COD: create order once, state pending confirmation, no payment success event.
- Ensure no production write occurs from preview.
