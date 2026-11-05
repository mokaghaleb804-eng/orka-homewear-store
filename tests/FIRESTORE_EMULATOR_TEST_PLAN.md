# ORKA isolated Firestore rules test plan (not executed)

Proposed rules: `tests/firestore.rules.proposed`. **Do not deploy these rules to the real project.** They intentionally deny all browser order writes; checkout requires a separately implemented trusted backend.

## Test environment
Use a local Firebase Firestore Emulator with a disposable test project (e.g. `demo-orka-security`). Do not connect to `orka-homewear-e63db`. The rules file must be loaded explicitly in emulator configuration. Never test with production data.

## Required assertions
1. Unauthenticated profile create denied.
2. Google user (uid=A, email claim, no phone claim) may create profile with displayName, email, createdAt; may read own profile.
3. Google user cannot create a profile with arbitrary phoneNumber, email or rewardCredit.
4. Phone-auth user may create profile with matching verified phone claim; spoofed phone denied.
5. Customer A cannot read customer B; cannot read B's orders.
6. Customer A can update own displayName and shippingAddress; cannot modify points, rewardCredit, lifetimeSpend, role, createdAt or email.
7. Non-admin cannot list customer documents; cannot write admins.
8. Admin with server-provisioned `admins/{uid}.role == 'admin'` can read profiles and orders, but cannot write orders from client SDK.
9. All browser-created orders are denied (including guest orders and authenticated orders), even when values look valid.
10. Browser updates to order status, loyalty, totals, customerUid or shippingPhone are denied.
11. Unknown document paths are denied.
12. Trusted server's Admin SDK order create and fulfillment are covered by separate server tests: emulator rules do not apply to Admin SDK.

## Blockers before adoption
- Current frontend creates customer documents with `points`, `rewardCredit` and `lifetimeSpend`; proposed rules intentionally reject these. Refactor client to omit server-owned fields.
- Current frontend sends order writes directly from browser; proposed rules intentionally reject these. Implement and test a backend endpoint first.
- Migration for existing customer profiles with different schema must be designed.
- A signed-in user can update their own shipping address, but the actual checkout phone must be stored in an order by the backend, not treated as an auth claim.
- Admin role assignment must remain server-only.
- Emulator tests have not been run. Do not merge or publish based on this draft.
