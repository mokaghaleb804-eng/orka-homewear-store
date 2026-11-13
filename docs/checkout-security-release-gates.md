# ORKA checkout security review — draft, not deployed

## Confirmed from repository
- `orders` reads require `isAdmin()` or a signed-in user whose UID matches the order.
- `admins/{uid}` is readable by that UID; writes are denied.
- Existing `orders` creation rules allow unauthenticated guests and accept client-supplied `total` and `items` without trusted catalog validation.
- Customer profile fields are partly stored in browser localStorage. Firebase Auth, Firestore, and analytics may also process user data.
- Storefront real order submission is currently disabled.

## Proposed fail-closed rule (in this branch)
- Deny client-side creation of `orders` until a server-side checkout creates orders with Admin SDK after verifying product price, quantity, shipping, inventory, authenticated/guest ownership and idempotency.
- This rule is NOT deployed and MUST NOT be merged without review; merging alone does not deploy Firestore rules.

## Required verification before release
1. Obtain deployed Firestore rules and compare with repository; verify all collections including RTDB rules.
2. Emulator tests: guest and customer cannot list/read others' orders, admin can read, non-admin cannot change points, unauthorized admin record writes denied.
3. Test no client can create or alter totals, statuses, reward credits or prices.
4. Audit loyalty points and customer storage, deletion, retention, and privacy disclosures.
5. Test server checkout, shipping price calculations, payment webhook signatures and duplicate delivery, refunds, and rollback.
6. Review Egypt data protection obligations with counsel before production processing.

No production changes authorized by this draft.

## Privacy and loyalty code audit (2026-11-13)
- `index.html` stores account records in `localStorage` via `readOrkaAccounts`/`saveOrkaAccounts`, including name, email, phone, points, pending and orders fields. These values are client-editable and must never authorize rewards or purchases.
- `window.checkOrkaAdminAccess` reads `admins/{uid}` in Firestore. This client check is only a UI control; actual authorization relies on deployed Firestore rules.
- Admin order loader performs a broad `getDocs(collection(db,'orders'))`, authorized only for admins by the repository rules. Confirm deployed rules match.
- `firestore.rules` permits `customers/{uid}` updates to selected profile fields and admin updates to points; no secure loyalty accrual pipeline is proven.
- Privacy draft now explicitly describes local account records, favorites, membership/loyalty display, and Firebase processing. Legal and deployed-service review remains required.
- Do not publish the draft privacy text or enable loyalty until accuracy is verified against live Firebase/RTDB behavior.

## Deployment evidence (user-confirmed, 2026-11-13)
- Owner pasted the full then-current Firestore rules from Firebase console, matching the earlier repository rules allowing client order creation.
- Owner pasted the revised rules into Firebase console and pressed Publish; subsequently confirmed `allow create: if false;` was still displayed in Rules after publishing.
- This is **visual owner confirmation**, not an independently executed SDK write-denial test or retrieved deployed ruleset version.
- Main branch privacy disclosure was separately updated (commit a08ad1d0f1d119b8ab8addc40b41030c7fc28ddb).
- CI static security gates completed successfully on the draft branch. The actual Firebase Emulator Suite and live unauthorized access tests remain unexecuted.
