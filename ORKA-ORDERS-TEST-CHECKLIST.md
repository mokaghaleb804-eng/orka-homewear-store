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

## Important limits
- This checklist has not yet been run; there is no runtime test result.
- The draft app currently depends on Firestore's existing order/customer schema.
- The proposed rules allow a signed-in customer to submit a delivery contact number that is not Firebase-verified. The UID must still match the authenticated user. This is intentional for the agreed Google/Facebook sign-in flow, but it should be reviewed before production.
- Do not deploy rules or merge this PR without explicit approval.
