# Secure checkout candidate — evidence, 2026-11-08

## Scope and authorization

Development-branch implementation and isolated testing only. The owner has NOT chosen final product prices, shipping fees or a carrier. No merge, real order, Firebase rules/config change, billing change or production release was performed by this work. `index.html`, `orka-orders.html` and the existing `firestore.rules` were left unchanged.

## Implemented candidate

- Server-owned five-minute quote with merchandise/shipping/total, bound to UID and canonical attempt input. Create rechecks current terms transactionally before saving.
- Registered and anonymous-guest identity separation. No client UID, amount, discount, points, timestamp or state is accepted.
- Deterministic order ID with a canonical fingerprint; reordered lines have the same fingerprint. Concurrent submissions and successful retries return one order; changed input under the same attempt is rejected.
- Session-persistent browser attempt ID, public quote and receipt. Contact details are not stored in the attempt record. Unknown network outcomes retain the attempt; a pending attempt cannot silently become a changed order. Retrying from a brand-new anonymous identity / device is not guaranteed to deduplicate.
- Whole-EGP safe integer pricing, server shipping, strict product IDs, made-to-order availability, size validation and aggregate per-product quantity caps across sizes.
- Server-only admin state transitions, required cancellation reason, deterministic audit event and retry result, admin role verified inside the transaction. No points awarded at delivery.
- Secure draft rules deny all client order writes, separate guest order visibility, permit bounded registered-user contact profiles and preserve financial-field immutability. These rules were loaded only in the local emulator.
- Separate synthetic browser store and admin panel. They use demo emulators through fixed loopback proxies, and cannot use the production Firebase project. Real storefront mapping and production admin integration remain deliberately blocked.

## Verification actually completed

`npm test`: **18 passing / 0 failed / 0 skipped**, using Firebase Auth and Firestore emulators, real Firestore transactions and rules. Includes six simultaneous creates, retry after quote expiry and intake disable, stale/foreign/changed quotes, rate limits, Google-provider and guest emulator identities, cross-user denial, no client order writes, no balance edits, idempotent audited state changes, and local session restoration.

The HTTP checks invoke the actual exported Firebase `onCall` handlers via Express bound to `127.0.0.1`, using real emulator-issued Auth tokens. Missing App Check is rejected. A separate runner with debug verification disabled rejects malformed and unsigned fake App Check tokens. Positive synthetic App Check uses the same debug-token mode as the Functions emulator; it is NOT evidence of a valid production attestation.

The official Functions emulator could load the functions but could not create its Unix runtime socket in this execution environment (`EPERM`). The loopback runner avoids that unsupported runtime mechanism; it does not replace the Firestore/Auth emulators or mock their transactions/rules. Its startup refuses any project except `demo-orka-checkout` and exact loopback emulator hosts. Tests ran on the local Node 24 host; CI is configured for the candidate Node 20 runtime and remains a separate remote result to verify.

Desktop browser QA completed against the bundled candidate adapters:

1. Synthetic Google-provider sign-in, authoritative total display (250 + 45 = 295 EGP), explicit confirmation and receipt.
2. Refresh retained the identity/attempt and returned the exact original order ID.
3. Guest sign-in and order creation without a visible Google login.
4. Demo admin viewed both orders and advanced a synthetic order through preparing → shipped → delivered.
5. Sign-out hid and cleared the admin panel; signing back in reloaded authorized order state.

These are synthetic Google-provider credentials accepted by the Auth emulator, not real Google OAuth. No real mobile device, production App Check, deployed Firebase rules or live checkout was tested.

## Reproduce locally

Requirements: Node 20 and Java 21. Install locked test dependencies with `npm ci --ignore-scripts` and `npm ci --prefix functions --ignore-scripts`. Run `npm test`; the command starts ONLY demo Auth/Firestore emulators and the loopback callable runners. No login, credentials or deploy command is needed.

For the synthetic browser preview, run `npm run dev`. It starts demo emulators, provisions only synthetic demo data, bundles local SDK dependencies, and serves the test UI. All sample prices and fees are fictional test fixtures. Do not copy sample settings into production. Close the dev process when finished.

## Remaining acceptance gates

1. Verify the new GitHub workflow on the exact branch head; it uses Node 20, Java 21 and locked dependencies, without deployment steps or credentials.
2. Implement and verify IP/device abuse controls before approving `abuseControlsApproved`; UID throttling alone does not prevent fresh-anonymous-identity abuse.
3. Approve stable catalog IDs, model names, exact size codes, real photographs, whole-EGP prices, availability/max quantities, shipping matrix, carrier policy and service contact. No product or shipping approval was inferred.
4. Integrate the real storefront and ORKA Orders only in a separately authorized staging environment; keep production gates disabled. Check historical order IDs/schema and customer financial records before migration. The candidate status API accepts new canonical 40-hex order IDs; legacy mutation needs its own migration decision.
5. Read and compare the effective deployed rules/configuration/indexes/region/billing/IAM. Validate real Google OAuth, Anonymous Auth, App Check and network limits in authorized staging, and test desktop/mobile plus account switching, quote expiry and lost-response recovery.
6. Review rollout/rollback and authorize backend/rules deployment separately. Only then conduct a controlled live SKU test and request a separate decision to enable real checkout. Never enable orders by only removing the existing storefront return.

This implementation does not close Issue #4 or certify production readiness.
