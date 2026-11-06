# ORKA Kids — launch readiness (preview branch only)

Status: **NOT READY FOR PRODUCTION**. This document is a review checklist, not an approval to deploy.

## Implemented in isolated preview
- Mobile demo bag, sizes and quantities; compact governorate / area / detailed-address checkout.
- Local-only simulated order and admin status history. Delivery identity is not persisted in demo orders.
- Offline checkout payload adapter and tests.
- Server-side trusted calculator, authenticated checkout boundary, admin-role lookup, status-change boundary, HTTP adapter and Firestore emulator tests. These are **prototypes**, not deployed APIs.
- Proposed Firestore rules under tests/firestore.rules.proposed. **Not deployed**.
- GitHub Actions runs unit tests and a disposable demo Firestore emulator. Verify the latest workflow run and investigate any failures before relying on results.

## Must pass before any production authorization
- [ ] Confirm all GitHub Actions jobs green at the exact release commit, including new regression tests.
- [ ] Manually test on Android mobile: empty cart, missing size, invalid phone, incomplete address, valid demo order, admin list, quantity, status history and duplicate prevention.
- [ ] Test real Google/phone authentication in a separate **non-production** Firebase project; Facebook login only if configured and approved.
- [ ] Verify checkout identity uses server-verified token UID; client cannot set UID, prices, points or discounts.
- [ ] Integrate a server-only endpoint in an isolated staging deployment with authentication, idempotency, trusted catalog, server pricing, logging without sensitive details, rate limits, and failure handling.
- [ ] Test admin access, revocation, server-only fulfillment, unauthorized requests and status transitions in staging.
- [ ] Audit Firestore rules against the actual current production schema and indexes; do not overwrite existing production rules blindly.
- [ ] Verify order privacy, customer data retention and consent; ensure no personal details in browser localStorage.
- [ ] Approve final real product photos, names, sizes, fabric, prices, stock/production availability, delivery areas/fees and 3–5-day target (subject to workshop confirmation).
- [ ] Decide payment method, refunds, exchanges, delivery policy, order confirmations, customer service and production capacity.
- [ ] Confirm whether ORKA Club is enabled; loyalty rules and discounts are **not** production-ready.
- [ ] Prepare rollback plan and secure backups; obtain explicit owner approval for every production change.

## Hard boundaries
- Do not merge into main, publish production deployments, change live Firebase rules or data, contact workshops or spend money without owner approval.
- Demo admin is **not** authenticated or connected to real orders. It is suitable only for local browser tests.
- Passing static checks or emulator tests does not prove end-to-end production readiness.
