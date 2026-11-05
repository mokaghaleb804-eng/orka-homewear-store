# ORKA checkout / Firebase security review — test branch only

Date: 2026-11-06. This is a **review document**, not a deployed rules change.

## Current code vs checked-in firestore.rules

1. **Google/Facebook profile creation fails:** rules require `customers/{uid}.phoneNumber == request.auth.token.phone_number`; social accounts normally have no phone claim. Current UI identifies social users using `social:<uid>` in localStorage, but this is not a verified phone number.
2. **Profile create field mismatch:** client creates `rewardCredit` and `lifetimeSpend`; rules only allow `displayName`, `phoneNumber`, `points`, `createdAt`, `shippingGov`, `shippingAddress`. Any extra fields are rejected.
3. **Order create field mismatch:** client sends loyaltyVersion, productSubtotal, redeemPoints, discount, membershipDiscountRate, membershipDiscount, rewardCreditUsed, rewardCreditEarned, eligibleSpend, payableTotal. Current rules allow only uid/customer/phone/gov/address/notes/items/total/status/createdAt. This write will fail.
4. **Social checkout phone mismatch:** rules require `orders.phone == request.auth.token.phone_number` for logged-in users, whereas social login may have no phone claim. Shipping phone must remain independent of identity.
5. **Guest order spoofing / trust boundary:** current rules allow unauthenticated create with `uid == null` and arbitrary `items` and `total` supplied by browser. Client cannot be trusted to price products, calculate discounts or loyalty credits.
6. **Admin delivery is incomplete:** rules permit a pending -> delivered status update with pointsAwarded flags but do not themselves atomically credit customer points, update lifetime spend or enforce once-only credit across related records. Use a trusted backend transaction and an idempotency marker.
7. **Preview isolation:** the standalone `isolated-preview.html` has no Firebase, but branch `index.html` still imports the real Firebase SDK and connects to real project. Do not test real social login on `index.html` or promote this branch.
8. **Rules source is not proof of deployed rules:** `firestore.rules` in GitHub might differ from Firebase Console deployed rules. Compare read-only before implementation.

## Safe design to implement (not yet applied)

- Auth identity: Firebase `uid` only; shipping contact stored separately as `shippingPhone`, normalized to E.164; email optional and not an authorization key.
- Customers: client may update limited personal/shipping fields only; points, tier, credit, spend and admin role are server-owned. Initial profile must work for Google/Facebook with no verified phone claim.
- Checkout: client sends only product IDs, size, quantity, shipping contact/address, notes. Trusted server reads active catalog prices, verifies inventory and allowed discounts, calculates total and creates order.
- Orders: customer reads own orders; admins read/manage orders; customer cannot directly change order totals, status, points, or ownership. Decide whether guest checkout is supported before writing rules.
- Fulfillment: server transaction handles pending -> confirmed -> preparing -> shipped -> delivered and exactly-once loyalty accrual after delivery; returns and cancellations require reversal policy.
- Preview: use Firebase emulator or a separate test project only with explicit approval; never use live customer data in tests.

## Tests required before any merge

- Google/Facebook user without phone can create/read own profile; no email field denial.
- Shipping phone can differ from auth phone; no account reassignment.
- Invalid Egyptian phone, blank address, invalid product, negative/fractional quantities rejected.
- Malicious client cannot submit arbitrary price/discount/credit/total.
- User A cannot read/update user B profile/orders; customer cannot grant self admin.
- Guest behavior explicitly decided and tested.
- Admin order transition permitted only for authorized admins.
- Delivery awards points once even if request retries or concurrent updates.
- Canceled/returned orders do not earn unearned rewards.
- No Firebase calls on isolated preview; branch index remains unsafe for live-login testing.
- Run automated tests and browser tests on an isolated environment; collect pass/fail evidence.

## Approval boundary

No edits to `main`, live Firebase rules, real customer/order data, production deployments, or live pricing. This file is documentation only.
