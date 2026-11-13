# ORKA Checkout — Preview implementation contract

Status: development-only. No production release, Firebase changes, or live payment activation.

## Customer experience
- Mobile-first checkout using ORKA navy #10294A, cream #FFFAF1, burgundy #A60F36; preserve official logo.
- Arabic/English, guest and signed-in checkout.
- Contact: mobile number, optional email and **unchecked** marketing opt-in.
- Delivery: name, governorate, city/area, street, building/apartment, additional directions.
- Shipping: show rate and ETA only from approved shipping configuration; otherwise clearly state "shipping cost pending confirmation" and do not collect an undisclosed amount.
- Payment options: Cash on Delivery (available when shipping and order terms are confirmed); Online payment (disabled / coming soon until provider integrated and tested).
- Coupon field: validate on trusted backend, never trust browser-side discounts.
- Breakdown: merchandise subtotal, approved shipping fee, validated discount, final total.
- Place order button: prevent duplicate submissions; show confirmation only after trusted order persistence.
- Never collect card numbers or CVV on ORKA pages; use hosted compliant provider checkout.
- Online status transitions must be verified by server-side signed callback/webhook, not return URL alone.

## Release gates
1. Approved prices, shipping matrix, COD eligibility, and terms.
2. Trusted backend recomputes all totals, verifies catalog and stock, uses idempotency key.
3. Authenticated customer ownership / guest access token, Firestore security rules, rate limiting.
4. Sandbox gateway integration: success, failure, cancellation, retry, callback replay and mismatch tests.
5. COD flow tests for guest and Google-signed-in customers, including mobile UX and Arabic/English.
6. Manual approval before any merge, deploy, production gateway credentials or live charges.

## Current status
Design and safety contract only. Neither the live payment gateway nor the checkout UI is implemented by this document.
