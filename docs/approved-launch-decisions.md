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

- The callable `createOrkaOrder` now requires privileged Firestore document `storeSettings/checkout` with `enabled: true`, `paymentMethod: "cod"`, `catalogApproved: true`, `shippingApproved: true`, `abuseControlsApproved: true`, and integer `shippingEGPByGovernorate` for the selected governorate. Missing document/flags/fees => reject. **Do not create or enable this production document yet.**
- Prices come only from approved `catalog/{productId}` records, never the current storefront's placeholder prices.
- Do not describe 3–5 days as end-to-end delivery; it is preparation time only.
- Do not claim a free-shipping offer, live checkout, or launch-ready status.
- No production Firebase rules changes, main branch changes, or deployment without end-to-end tests and explicit approval of the final rollout.

## Remaining technical work

1. The isolated emulator preview now supports registered/guest checkout and persistent session attempt IDs. Integrating the real storefront remains blocked until catalog approval.
2. A five-minute server-owned pre-submit quote is implemented and tested locally. The create transaction rejects changed terms and requires a new customer confirmation.
3. Provision reviewed catalog and shipping fees with admin-only workflow.
4. Isolated demo admin displays canonical amounts and invokes transactional status changes. Production ORKA Orders is intentionally unchanged.
5. Configure App Check, abuse controls for fresh guest identities, and validate Firebase Auth anonymous sign-in.
6. Migrate customer profile rules without breaking Google login or ORKA CLUB.
7. Run emulator tests, browser/mobile tests, then request separate release approval.

