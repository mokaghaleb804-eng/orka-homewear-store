# ORKA launch inventory and catalog mapping — NOT APPROVED FOR SALES

Inspection of `index.html` on 2026-11-07 confirmed:
- `ORKA_TEST_PRICES = true` and checkout deliberately returns early.
- Storefront `products` use numeric IDs `1...` with placeholder names and prices; cart is populated by `cart.push({...p,size,qty:1})`.
- The draft secure checkout client expects `cart[].productId`, which does **not** currently exist in storefront cart entries.
- The secure server function reads `catalog/{productId}` and expects `active=true`, integer `priceEGP`, valid `sizes`, and `name`. No production catalog was verified.

## Release gate

Do not auto-import placeholder prices or activate catalog records from the current HTML. Confirm final product IDs, names, sizes, availability and selling prices for each of the ten winter models with the ORKA owner. Then create authoritative catalog via privileged server/admin provisioning workflow (never through public browser writes).

Map numeric storefront `id` to stable catalog `productId` explicitly, and make the checkout UI display the server-confirmed total (not its untrusted local estimate) before final submission. The customer must approve that final total. Shipping is not yet defined; the current draft backend sets `shippingEGP: 0`, which must not be treated as an approved free-shipping policy.

## Additional blockers

- The guest client requires Firebase Anonymous Auth to be enabled; verify project configuration and App Check for web.
- The draft rules intentionally deny profile writes and will break existing customer onboarding; migrate to server-managed profiles or write tightly validated rules before deploy.
- The draft callable's per-UID throttle does not protect against many fresh anonymous identities; add App Check and network abuse controls.
- The draft callable's order data shape (`totalEGP`, `checkoutMode`) needs to be reconciled with ORKA Orders PWA, which may read `total` and `status`.
- Configure a real delivery and payment policy; loyalty remains off until server-side idempotent fulfillment.
- No emulator/browser tests have been run. No Firebase or production deployment authorized by this document.

## Acceptance tests

1. Registered Google customer creates a canonical order at server-confirmed price; it appears in admin.
2. Guest customer creates an order without Google login; order appears in admin, guest cannot list other orders.
3. Tampered price/discount/points ignored or rejected; unknown SKU/size rejected.
4. Duplicate requestId returns same order, different payload rejected.
5. Admin read works; customer cannot read another customer's order; guest cannot enumerate orders.
6. No loyalty points or live delivery writes in this release.
7. Checkout retry and browser refresh preserve the attempt ID, and error messages do not expose PII.
