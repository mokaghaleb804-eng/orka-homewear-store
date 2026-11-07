# ORKA launch decisions — approved 2026-11-07

These are business decisions, **not permission to deploy untested production changes**.

| Setting | Approved value |
| --- | --- |
| Payment | Cash on delivery (COD) only |
| Delivery coverage | All Egyptian governorates |
| Shipping fees | NOT APPROVED / TBD |
| Product prices | NOT APPROVED / TBD; may vary per model |
| Preparation time | 3–5 days **before carrier transit** |
| Product photography | Real photography pending |
| Customer service phone | TBD |
| Checkout modes | Google signed-in + guest (secure session) |

## Mandatory safe launch behavior

- The callable `createOrkaOrder` now requires privileged Firestore document `storeSettings/checkout` with `enabled: true`, `paymentMethod: "cod"`, `catalogApproved: true`, `shippingApproved: true`, and integer `shippingEGPByGovernorate` for the selected governorate. Missing document/flags/fees => reject. **Do not create or enable this production document yet.**
- Prices come only from approved `catalog/{productId}` records, never the current storefront's placeholder prices.
- Do not describe 3–5 days as end-to-end delivery; it is preparation time only.
- Do not claim a free-shipping offer, live checkout, or launch-ready status.
- No production Firebase rules changes, main branch changes, or deployment without end-to-end tests and explicit approval of the final rollout.

## Remaining technical work

1. Integrate authenticated and guest checkout into a preview storefront, preserving idempotency key on retries.
2. Require a server-authoritative pre-submit quote including shipping before customer confirms the amount. Recalculate in createOrder transaction; reject material changes since quote.
3. Provision reviewed catalog and shipping fees with admin-only workflow.
4. Make ORKA Orders admin display the canonical server order schema and status.
5. Configure App Check, abuse controls for fresh guest identities, and validate Firebase Auth anonymous sign-in.
6. Migrate customer profile rules without breaking Google login or ORKA CLUB.
7. Run emulator tests, browser/mobile tests, then request separate release approval.
