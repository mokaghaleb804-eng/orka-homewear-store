# ORKA CLUB Firebase rollout checklist — release gate

Status: **BLOCKED**. Tests on the preview branch do not mean production is ready.

## Verified in CI
- Preview wallet calculation and sequential in-memory ledger tests
- Known-vulnerability detection tests (expected issues, not fixes)
- Firestore owner-read-only rules tests in an isolated emulator
- Existing checkout security static gates

## Preview implementation progress (not release approval)
- [x] Firestore emulator grant/redeem/return transaction prototypes and authorization tests have passed on earlier commits.
- [x] Added server-priced checkout calculation contract and CI tests; this is not yet connected to a privileged endpoint or authoritative catalog store.
- [x] Redemption prototype binds one operation to an order and uses a server-controlled clock.
- [ ] Verify the newest checkout contract CI run and any subsequent emulator failures.
- [ ] Establish authenticated Firebase UID at the actual server endpoint (never trust a caller-provided UID).
- [ ] Fetch active SKU/size/color price and shipping rates from trusted persisted catalog, not caller-supplied catalog object.
- [ ] Make checkout creation, inventory, COD totals, and wallet discount one trusted atomic workflow.

## Critical blockers (must all be green)
- [ ] Implement privileged Cloud Functions/Cloud Run checkout using trusted server-side catalog pricing and delivery status; no client-authoritative totals.
- [ ] Provision and validate Firebase billing, region, secrets, App Check, least-privilege IAM and deployment rollback plan.
- [ ] Implement persistent Firestore transaction adapter for grant/redeem with durable idempotency, contention retries and authoritative auth UID.
- [ ] Implement reversal/refund ledger and approve clawback policy for already-spent rewards.
- [ ] Add emulator integration tests for parallel redemption, replay after process restart, owner spoofing, returns, expiry and partial returns.
- [ ] Decide legacy points/tiers migration without erasing existing customer entitlements.
- [ ] End-to-end checkout test for guest, Google account, shipping, COD, admin fulfillment, cancel/refund.
- [ ] Test preview UI in Arabic/English on mobile, including accessibility and error handling.
- [ ] Confirm security rules deployed are exactly reviewed rules and RTDB permissions remain compatible.
- [ ] Obtain final deployment approval for exact release commit, Firebase project and environment, with rollback and monitoring.

## Release order
1. Validate trusted checkout and backend in isolated emulator.
2. Deploy privileged backend and rules with wallet **feature flag OFF**; verify no user-facing behavior change.
3. Run staging end-to-end tests, then a monitored limited rollout only after explicit final confirmation.
4. Enable customer wallet UI after verified backend and business rules.

Do not merge PR #27 or deploy from this checklist alone.
