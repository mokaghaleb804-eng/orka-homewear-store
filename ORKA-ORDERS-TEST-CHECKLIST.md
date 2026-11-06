# ORKA Orders PWA — Safe Test Checklist

This is a review/test plan only. No production deployment, Firestore rules deployment, or billing changes are authorized by this document.

## Draft files
- App: `orka-orders.html`
- Manifest: `orka-orders.webmanifest`
- Service worker: `orka-orders-sw.js`
- Icon: `orka-orders-icon.svg`
- Proposed rules: `firestore.rules.proposed` (not deployed)

## Before testing
1. Confirm the admin's Firebase Auth UID matches `admins/{uid}` and `role` is the string `admin`.
2. Confirm the test hostname is listed in Firebase Authentication > Settings > Authorized domains.
3. Review the proposed rules against the currently deployed rules; do not paste/publish them before review.
4. Use a separate test customer and a clearly identified test order. Do not mark a real order delivered just to test points.

## Functional tests
1. Open the app on the approved test host over HTTPS.
2. Sign in with the authorized admin's Google account.
3. Verify a non-admin account is denied access to order data.
4. Verify the orders list, pending/delivered counts, search, and filters.
5. Create a test order using Google/Facebook sign-in with a checkout contact phone number that is not Firebase phone-authenticated. Verify the order has the authenticated user's UID and a contact phone.
6. Create a guest test order and verify it has `uid: null`; it must not award points to an unrelated account.
7. On the test order only, confirm delivery once and verify points equal `floor(total / 50)`.
8. Attempt to confirm the same order again; the app must block duplicate point awards.
9. Verify the customer profile, points, and order status update consistently on the website.
10. Verify app install prompt / Add to Home Screen on a supported mobile browser.

## Preview hosting constraint
- The repository already has GitHub Pages enabled for the live ORKA website. Deploying this draft as the repository's Pages site could replace the live site, so no Pages deployment was made. A separate preview requires a genuinely separate hosting target/repository or an approved deployment arrangement that preserves the current site.

## Important limits
- Static automated checks passed on 2026-10-26 (manifest JSON and referenced assets, app module syntax, and service-worker syntax). This is not a runtime test result.
- The draft app currently depends on Firestore's existing order/customer schema.
- The proposed rules allow a signed-in customer to submit a delivery contact number that is not Firebase-verified. The UID must still match the authenticated user. This is intentional for the agreed Google/Facebook sign-in flow, but it should be reviewed before production.
- Do not deploy rules or merge this PR without explicit approval.


## Internal TEST simulator (2026-11-06)
- Admin sign-in is checked against Firestore `admins/{uid}` with `role: admin` before the simulator UI is shown.
- TEST simulator orders are local browser data, scoped to the signed-in admin UID; they do **not** create Firestore documents and are not shared between admins or devices.
- Real order counts exclude local TEST orders. Filter `TEST محلي فقط` shows local test records.
- Local TEST records are clearly marked and have no delivery/points action. The delivery transaction also refuses any Firestore order marked `isTest: true`, `test: true`, `orderType: 'test'`, or `environment: 'test'`.
- TEST simulator is **not** an end-to-end Firebase checkout test. Do not report it as such.
- Before merging: run static checks, test on a real browser with an authorized admin and a non-admin, verify local TEST create/filter/delete and refresh persistence, verify live customer checkout remains disabled, and separately review Firestore rules/schema mismatches.
- **Known blocker:** `firestore.rules` restricts `orders` creates to an exact set of fields and requires a Firebase phone claim for signed-in users, whereas current Google checkout code uses extra fields and a contact phone. The proposed rules file is not deployed and must not be published without full review.
- Do not merge or publish this draft until runtime verification and production-safety review are complete.

## Release blockers verified in source (2026-11-06)
- The latest PR workflow run #20 passed, including the new checkout-disabled/guest-loyalty regression checks. A separate push run #19 failed; inspect that run's logs before treating push checks as consistently green.
- **Do not deploy `firestore.rules.proposed` as written:** `orders.create` accepts browser-supplied `total` and `items` without a trusted price/catalog calculation. A client could submit an arbitrary total; delivery currently awards `floor(total/50)` points. This is a loyalty fraud risk, not merely a schema mismatch.
- **Do not enable real checkout yet:** production checkout is intentionally disabled, and browser-based TEST orders do not exercise Firestore writes.
- Before real checkout: enforce trusted server-side pricing and product availability, verify order ownership and payment/delivery conditions, and award points only from a trusted verified order amount using a single idempotent server-side workflow. Firestore rules alone cannot establish trusted prices from arbitrary browser-supplied cart contents.
- Current admin UI can mutate live order/customer documents when an authorized admin confirms delivery. Keep that action restricted to verified real deliveries; preview TEST orders are local-only.
- Release requires browser tests for admin/non-admin, Google auth domain, Firestore permissions, local TEST persistence, and a safe separate preview origin. None of those are covered by the static workflow.

## CI fix and preview release status
- The workflow originally matched only one literal checkout-disabled notice. The current branch instead uses `const ORKA_TEST_PRICES = true` and returns early from `submitOrder`; workflow now accepts either verified gate pattern. PR check #27 passed after this change.
- `ENABLE_LIVE_DELIVERY=false` additionally blocks the admin preview's delivery/loyalty action; this is a UI/client safeguard, not an authorization boundary. Do not rely on it to secure Firestore.
- **Status: REVIEW ONLY**. PR is draft, no verified mobile browser/Firebase auth test, and no production rules deployment. Do not label ready to launch based on CI alone.
