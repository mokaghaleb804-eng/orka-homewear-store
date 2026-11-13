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
