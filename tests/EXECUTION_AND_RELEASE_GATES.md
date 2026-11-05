# ORKA isolated test execution — required before merge

## Local unit tests (no Firebase credentials)
Run from repository root with Node.js 22:
```sh
node --test tests/*.test.mjs
```
The branch workflow `.github/workflows/orka-test.yml` is intended to run these on test-file pushes. **Do not report success until logs show all tests passing.**

## Firestore Emulator setup
Use a disposable Firebase project identifier beginning with `demo-` and a temporary directory, never the live project `orka-homewear-e63db`:
```sh
mkdir -p /tmp/orka-firestore-emulator
cp tests/firestore.rules.proposed /tmp/orka-firestore-emulator/firestore.rules
cp tests/firebase.emulator.example.json /tmp/orka-firestore-emulator/firebase.json
cd /tmp/orka-firestore-emulator
firebase emulators:start --project demo-orka-security --only firestore
```
Requires Firebase CLI installed. This starts an emulator only; it does **not** deploy rules. The existing `FIRESTORE_EMULATOR_TEST_PLAN.md` is an assertion checklist, not executable rules tests yet.

## Security release blockers
1. No live endpoint is wired. Backend must verify tokens with Admin Auth and load catalog from trusted server storage.
2. Test fixtures and fake transactions do not prove Firestore transaction concurrency or rules enforcement.
3. Browser-provided role must never reach the service as trusted input; use `createAuthorizedFulfillment` plus server-side `createAdminRoleLookup`.
4. `admins/{uid}` records must be provisioned by a trusted operator only.
5. Current test-only checkout requires sign-in; guest checkout is not implemented.
6. Product stock is checked but **not reserved atomically**; simultaneous checkouts can oversell. Implement stock reservation or made-to-order capacity policy before launch.
7. No approved shipping charge, live product prices, loyalty accrual or returns reversal policy is implemented.
8. An idempotency key cannot be reused with changed order payload. Real clients must persist the key across retries and create a new key for a new order.
9. Do not activate proposed rules until frontend profile schema and order API are migrated and emulator tests pass.
10. Add real Firestore emulator integration tests, network failure/retry tests, and mobile browser smoke tests before any deployment.
