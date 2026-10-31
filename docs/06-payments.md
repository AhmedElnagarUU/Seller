# 06 — Payments

How customers pay, how we record payments, and how refunds work.
There are **two payment methods**:

| Method | Who can use it | How it works | Currency |
|---|---|---|---|
| **Card** (Polar) | Everyone | Polar's hosted checkout. Polar tells us by webhook. Automatic. | USD |
| **Egyptian wallet** | Customers with `country = "EG"`, when enabled in settings | Customer transfers money by hand and uploads proof. Admin approves. Manual (D-100). | EGP |

Related docs: data in `03-data-model.md` (orders 7, ownerships 8, coupons 9, walletPayments 10, webhookEvents 16),
emails in `09-emails.md`, pages in `05-pages.md`.

---

## 1. Files

```
features/payments/
├─ payment.types.ts            PaymentProvider interface, PaymentEvent, NormalizedOrder
├─ payment.provider.ts         getPaymentProvider(): returns the Polar or fake provider (from env.PAYMENT_PROVIDER)
├─ polar/polar.provider.ts     Polar implementation (only file importing @polar-sh/sdk, with polar.mapper.ts)
├─ polar/polar.mapper.ts       Polar payload → NormalizedOrder / PaymentEvent
├─ fake/fake.provider.ts       Fake implementation for local development and E2E (D-133)
├─ webhook-event.model.ts
├─ webhook-event.repository.ts
├─ payment-sync.service.ts     Sends themes (products) and coupons (discounts) to the provider
├─ payment-event.service.ts    processPaymentEvent(): the ONE place that turns a payment event into DB changes
├─ payment.webhook.ts          handlePaymentWebhook(request): Response — used by app/api/webhooks/polar/route.ts
├─ checkout.service.ts         startCardCheckout(), getCheckoutPageData()
├─ checkout.actions.ts         applyCouponAction, startCardCheckoutAction, setCountryAction, simulateFakePaymentAction
├─ checkout.schemas.ts
└─ components/                 CheckoutSummary, CouponField, PaymentMethodPicker, SuccessWaiting, ...

features/wallet-payments/
├─ wallet-payment.model.ts / .repository.ts / .service.ts / .mapper.ts / .actions.ts / .schemas.ts / .types.ts / .constants.ts
└─ components/                 WalletInstructions, WalletProofForm, admin/WalletReviewPanel, ...
```

`payment.webhook.ts` uses only the standard `Request`/`Response` types (no `next/*`), so it can move to Express.

---

## 2. The `PaymentProvider` interface (D-032)

`payment.types.ts`:

```ts
export type ProviderName = "polar" | "fake";

export type NormalizedOrder = {
  providerOrderId: string;
  checkoutId: string | null;
  providerCustomerId: string | null;
  userId: string;            // from checkout metadata
  themeId: string;           // from checkout metadata
  couponId: string | null;   // from checkout metadata ("" → null)
  currency: string;          // lowercase, must be "usd"
  subtotalAmount: number;    // minor units
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAt: Date;
};

export type PaymentEvent =
  | { kind: "order_paid"; eventId: string; type: string; order: NormalizedOrder }
  | { kind: "order_refunded"; eventId: string; type: string; providerOrderId: string;
      refundedAmount: number; isFullRefund: boolean }
  | { kind: "ignored"; eventId: string; type: string };

export interface PaymentProvider {
  name: ProviderName;
  // Creates or updates the provider product for a theme. Returns the product id.
  upsertProduct(input: { themeId: string; name: string; tagline: string; priceCents: number;
                         existingProductId: string | null }): Promise<{ productId: string }>;
  // Creates or updates the provider discount for a coupon. Returns the discount id.
  upsertDiscount(input: { couponId: string; code: string; type: "percent" | "fixed";
                          percentOff: number | null; amountOffCents: number | null;
                          productIds: string[] | null; existingDiscountId: string | null }): Promise<{ discountId: string }>;
  // Creates a hosted checkout. Returns its id and the URL to send the customer to.
  createCheckout(input: { productId: string; discountId: string | null; userId: string; themeId: string;
                          couponId: string | null; customerEmail: string; customerName: string;
                          successUrl: string }): Promise<{ checkoutId: string; url: string }>;
  // Verifies the signature and converts the webhook into a PaymentEvent.
  // Throws WebhookSignatureError (from payment.types.ts) when the signature is wrong.
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent>;
}

export class WebhookSignatureError extends Error {}
```

Rules:
- Nothing outside `features/payments/polar/` knows Polar field names. Everything else uses these types.
- `getPaymentProvider()` returns the fake provider only when `env.PAYMENT_PROVIDER === "fake"`.
  `shared/config/env.ts` **refuses to start** when `PAYMENT_PROVIDER=fake` and `NODE_ENV=production`.

---

## 3. Syncing themes and coupons to Polar (D-033)

All in `payment-sync.service.ts`. Called by the themes and coupons services **after** their own DB write succeeds
(never inside the transaction — an outside API call must not hold a transaction open).

### 3.1 Theme → Polar product

| When | What |
|---|---|
| Theme created | `upsertProduct` with `existingProductId: null`; save `provider.productId`, `provider.syncedAt`. |
| Theme `name`, `tagline` or `priceCents` changed | `upsertProduct` with the existing id; update `provider.syncedAt`. |
| Sync fails | Theme stays saved. Admin theme page shows **"Not synced with payment provider"** and a **Retry sync** button. `console.error` the failure. |

Polar product content: name = theme name, description = tagline, one **fixed one-time price** in USD = `priceCents`,
metadata `{ themeId }`.

A theme cannot be published while `provider.productId` is `null` (`03-data-model.md` section 5).

### 3.2 Coupon → Polar discount

| When | What |
|---|---|
| Coupon created | `upsertDiscount`; save `provider.discountId`, `provider.syncedAt`. |
| Sync fails | Coupon stays saved. The first card checkout that uses it tries the sync again (section 5.3 step 5). |

Polar discount content: percent → percentage of `percentOff`; fixed → fixed `amountOffCents` USD; duration **once**;
for `appliesTo: "selected"`, restricted to those themes' product ids. **No** expiry and **no** redemption limit at
Polar: our server enforces those (section 4), and customers cannot type codes on Polar's page.

> Planner verification before the Polar task (not for the implementing agent): confirm with the current Polar API
> (SDK `@polar-sh/sdk/2026-10`): (1) how a product's price is changed (update with a new `prices` list),
> (2) the discount create body (`basis_points` for percentage), (3) that `success_url` supports the
> `{CHECKOUT_ID}` placeholder. The task file will contain the exact calls.

---

## 4. Coupon check (both methods)

`couponService.quote({ themeId, priceCents, code })` in `features/coupons/coupon.service.ts`.
Checks run **in this order**; the first failure returns its message:

| # | Check | Error message |
|---|---|---|
| 1 | Code (uppercased, trimmed) exists | `"This coupon code is not valid."` |
| 2 | `active` is `true` | `"This coupon code is not valid."` |
| 3 | `expiresAt` is `null` or in the future | `"This coupon has expired."` |
| 4 | `maxRedemptions` is `null` or `redemptionsCount < maxRedemptions` | `"This coupon has reached its usage limit."` |
| 5 | `appliesTo` is `"all"`, or `themeIds` contains the theme | `"This coupon cannot be used for this theme."` |
| 6 | Price after discount is at least 100 cents | `"This coupon cannot be used for this theme."` |

Discount calculation (integers only):
- percent: `discountCents = Math.round(priceCents × percentOff / 100)`
- fixed: `discountCents = amountOffCents`
- `finalCents = priceCents − discountCents`

Examples: price 2900, 20 % → discount 580, final 2320. Price 2900, fixed 1000 → final 1900. Price 900, fixed 1000 → error #6.

For card payments, this quote is **for display**. The amounts saved in the order always come from Polar's webhook.
For wallet payments, this quote is the real price.

---

## 5. Card payment flow

### 5.1 Steps

```
Theme page "Buy"
  → /checkout/[slug]               (our page: summary, coupon field, payment method)
  → startCardCheckoutAction         (server)
  → redirect to Polar checkout URL
  → customer pays on Polar
  → Polar redirects to /checkout/success?checkout_id=...
  → Polar sends webhook order.paid → /api/webhooks/polar → processPaymentEvent → order + ownership
  → success page sees the order → "Download"
```

### 5.2 `/checkout/[slug]` page data — `getCheckoutPageData(userId, slug, couponCode | null)`

Requires `requireVerifiedUser()`. Returns theme summary, `priceCents`, the coupon quote (or the coupon error),
and the available methods:
- `card`: always.
- `wallet`: only when the user's `country` is `"EG"` **and** `settings.walletEnabled` is `true`.
  Includes the EGP amount (section 6.2) so the customer sees both prices.

If the user's `country` is `null`, the page first shows a **country select** (`setCountryAction`), then the normal page.
If the user already owns the theme → redirect to `/account/themes`.

### 5.3 `startCardCheckout(input)` — in `checkout.service.ts`

Input: `{ userId, customerEmail, customerName, themeSlug, couponCode: string | null }`.

| Step | Check / action | On failure |
|---|---|---|
| 1 | Theme exists and is `published` | `AppError("NOT_FOUND", "This theme is not available.")` |
| 2 | User has no `active` ownership of it | `AppError("CONFLICT", "You already own this theme.")` |
| 3 | If `couponCode`: `couponService.quote` (section 4) | `AppError("INVALID", <coupon message>)` |
| 4 | `theme.provider.productId` is not null | `AppError("INVALID", "Card payment is not available for this theme right now. Please try again later.")` + `console.error` |
| 5 | If coupon has no `provider.discountId`: sync it now (3.2) | same message as step 4 |
| 6 | `provider.createCheckout(...)` with `successUrl = APP_URL + "/checkout/success?checkout_id={CHECKOUT_ID}"`, metadata `userId`, `themeId`, `couponId` (`""` when none) | same message as step 4 |
| 7 | Return `{ url }` | — |

The action then calls `redirect(url)` (outside `try/catch`).

### 5.4 Success page — `/checkout/success?checkout_id=...`

- `requireUser()`. Look up the order by `provider.checkoutId` **and** `userId` (never show another user's order).
- **Found:** "Thank you! <Theme> is yours." + **Download** button + link to My Themes.
- **Not found yet:** "Confirming your payment…" with a small client component that calls `router.refresh()`
  every 3 seconds, at most 10 times. After that: "Your payment is being confirmed. This can take a few minutes.
  We'll email you as soon as your theme is ready."
- Missing or invalid `checkout_id` → redirect to `/account/orders`.

---

## 6. Webhooks — `handlePaymentWebhook(request)`

Route: `POST /api/webhooks/polar`. The route file only calls `handlePaymentWebhook(request)`.

### 6.1 Steps

| Step | Action | HTTP response |
|---|---|---|
| 1 | `rawBody = await request.text()` (the **raw** text — the signature is checked against it) | |
| 2 | `event = await provider.parseWebhook(rawBody, request.headers)` | `WebhookSignatureError` → **403** `{ "error": "Invalid signature" }`. Body not valid → **400**. |
| 3 | `result = await processPaymentEvent(event)` | see 6.3 |
| 4 | Return | **200** `{ "received": true }` |

Polar retries a webhook when it gets a non-2xx response. We use that: **temporary** problems return 500 so Polar
tries again; **permanent** problems (bad data that will never work) return 200 and are marked `failed` for the admin.

### 6.2 What the Polar provider maps

| Polar event | Our event | Notes |
|---|---|---|
| `order.paid` | `order_paid` | From the order: `id`, `checkout_id`, `customer_id`, `metadata.userId/themeId/couponId`, `currency`, `subtotal_amount`, `discount_amount`, `tax_amount`, `total_amount`, `created_at`. |
| `order.refunded` | `order_refunded` | `refundedAmount = refunded_amount + refunded_tax_amount`; `isFullRefund = (status === "refunded")`. |
| any other type, or a type the SDK does not know | `ignored` | |

The event id is the `webhook-id` header.

### 6.3 `processPaymentEvent(event)` — in `payment-event.service.ts`

This is the **only** function that turns a payment event into database changes. The webhook handler and the fake
provider's "simulate payment" both call it.

1. **Idempotency** (`webhookEvents`):
   - Insert `{ provider, eventId, type, status: "processing" }`.
   - If the unique index rejects it: read the existing row. `processed` or `ignored` → return `"duplicate"` (HTTP 200).
     `processing` or `failed` → set it to `processing` and continue (a retry).
2. `ignored` → set status `ignored`, return.
3. `order_paid` → `orderService.recordCardOrder(event.order)` (writes in `03-data-model.md` section 19), then:
   - **Permanent errors** (mark `failed`, store message, `console.error`, return HTTP **200**):
     `userId` or `themeId` missing/invalid/not found; `currency !== "usd"`.
   - **Temporary errors** (DB errors, anything unexpected): mark `failed`, return HTTP **500**.
   - After the transaction: send the order confirmation email (failure is logged, does not change the response).
4. `order_refunded` → `orderService.recordRefund({ providerName, providerOrderId, refundedAmount, isFullRefund })`:
   - Order not found → **temporary** (HTTP 500): the `order.paid` webhook may not be processed yet; Polar will retry.
   - Status rules: `03-data-model.md` section 7 (use `isFullRefund` to decide `refunded` vs `partially_refunded`).
5. Set status `processed`, `processedAt`.

### 6.4 Rules
- Never log the webhook body. Log only `eventId`, `type`, and our error message.
- The same event processed twice must not create a second order, a second ownership or double-count
  `salesCount` / `redemptionsCount` (protected by the `webhookEvents` and `orders` unique indexes + the transaction).

---

## 7. Egyptian wallet flow (manual)

All in `features/wallet-payments/`.

### 7.1 Start — `startWalletPayment({ userId, themeSlug, couponCode })`

| Step | Check / action | On failure |
|---|---|---|
| 1 | User `country === "EG"` | `AppError("FORBIDDEN", "Wallet payment is only available for customers in Egypt.")` |
| 2 | `settings.walletEnabled` is `true` | `AppError("INVALID", "Wallet payment is not available right now.")` |
| 3 | Theme `published` | `AppError("NOT_FOUND", "This theme is not available.")` |
| 4 | No `active` ownership | `AppError("CONFLICT", "You already own this theme.")` |
| 5 | An **open** request for this user + theme exists → return it (do not create a new one) | — |
| 6 | If `couponCode`: `couponService.quote` | `AppError("INVALID", <coupon message>)` |
| 7 | Calculate `amountEgp` (7.2), generate `referenceCode` (7.3) | — |
| 8 | Insert `walletPayments` with `status: "awaiting_payment"`, `isOpen: true` | — |
| 9 | Return the request id | — |

The action redirects to `/account/wallet-payments/[id]`.

### 7.2 EGP amount (D-101) — `shared/lib/money.ts` → `usdCentsToEgpPounds(cents, rate)`

Integer math only, so there are no rounding surprises:

```
rateHundredths = Math.round(rate × 100)            // 50.5 → 5050
amountEgp      = Math.ceil(cents × rateHundredths / 10000)
```

Examples: 2900 cents at 50.5 → 2900 × 5050 / 10000 = 1464.5 → **1465 EGP**. 2320 cents at 48 → 1113.6 → **1114 EGP**.

### 7.3 Reference code

`TS-` + 6 random characters from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, using `crypto.randomInt`.
If the unique index rejects it, generate a new one (at most 5 tries, then throw).

### 7.4 Payment page — `/account/wallet-payments/[id]`

Only the owner of the request can see it (otherwise `notFound()`). Shows by status:

| Status | Shows |
|---|---|
| `awaiting_payment` | Amount in EGP (large), reference code with a copy button, each wallet account (label, account, instructions), the steps "1. Send exactly <amount> EGP. 2. Write <reference> in the transfer note. 3. Upload the screenshot below.", the **proof form**, and a **Cancel** button. |
| `submitted` | "We received your payment details. We'll review them within 24 hours and notify you." + the submitted details. |
| `approved` | "Payment approved. <Theme> is yours." + Download button. |
| `rejected` | The rejection reason + "Start a new payment" button (goes back to `/checkout/[slug]`). |
| `cancelled` | "This payment was cancelled." + link back to the theme. |

### 7.5 Submit proof

1. **Upload URL:** `createProofUploadUrlAction({ walletPaymentId, contentType, sizeBytes })`
   - Request must belong to the user and be `awaiting_payment`.
   - `contentType` in `image/jpeg | image/png | image/webp`; `sizeBytes` 1 – 5 242 880.
     Else `"Please upload a JPG, PNG or WebP image up to 5 MB."`
   - Key: `wallet-proofs/<walletPaymentId>/<random 16 hex chars>.<jpg|png|webp>` in the **private** bucket.
   - Returns a presigned **PUT** URL valid for 10 minutes. The browser uploads the file directly.
2. **Submit:** `submitWalletProofAction({ walletPaymentId, senderPhone, transactionId, proofKey })`
   - Same ownership/status checks.
   - `senderPhone` must match `egyptMobile`, else `"Please enter the Egyptian mobile number you paid from (11 digits, starts with 01)."`
   - `proofKey` must start with `wallet-proofs/<walletPaymentId>/`, and the object must exist in storage with an allowed
     content type and size (check with a HEAD request). Else `"We could not find your screenshot. Please upload it again."`
   - Set `status: "submitted"`, `submittedAt`, fields. Log `wallet_payment_submitted`.
   - After saving: email the owner (first address in `ADMIN_EMAILS`) "New wallet payment to review" (`09-emails.md`).

### 7.6 Admin review — `/admin/wallet-payments/[id]`

- Screenshot shown through a signed GET URL valid for 5 minutes (D-104).
- **Approve** (`approveWalletPaymentAction`): status must be `submitted`, else
  `"This payment was already reviewed."`. Writes: `03-data-model.md` section 19. Then the approval email.
- **Reject** (`rejectWalletPaymentAction`, reason 5–500 chars): same status check. Then the rejection email.
- **Mark as refunded** (on the wallet order page, `markWalletOrderRefundedAction`): order must be `method: "wallet"` and
  `status: "paid"`, else `"This order cannot be marked as refunded."`.
- The admin should check the money **actually arrived** in the wallet (amount + reference) before approving.
  The page shows this reminder above the buttons.

---

## 8. Fake provider (local development and E2E)

`fake/fake.provider.ts`, used only when `PAYMENT_PROVIDER=fake` (never in production).

| Method | Fake behaviour |
|---|---|
| `upsertProduct` | Returns `fake_prod_<themeId>`. |
| `upsertDiscount` | Returns `fake_disc_<couponId>`. |
| `createCheckout` | Saves nothing. Returns `checkoutId = "fake_chk_" + random`, `url = APP_URL + "/checkout/fake/<checkoutId>?theme=<themeId>&coupon=<couponId>"`. |
| `parseWebhook` | Not used (throws). |

The page `/checkout/fake/[checkoutId]` (returns `notFound()` unless `PAYMENT_PROVIDER=fake`) shows the theme, the
price after coupon and a **Simulate successful payment** button. The button's action builds an `order_paid` event
(`eventId = "fake_evt_" + checkoutId`, provider order id `fake_ord_<checkoutId>`, amounts from the coupon quote,
tax 0) and calls **the same** `processPaymentEvent`, then redirects to `/checkout/success?checkout_id=<checkoutId>`.

A test-only helper `simulateFakeRefund(providerOrderId, isFullRefund)` in `fake.provider.ts` builds an
`order_refunded` event and calls `processPaymentEvent`. It is used by tests, not by any page.

This lets the whole purchase flow run in tests and E2E with **real** order/ownership logic and no network.

---

## 9. Testing with the real Polar sandbox

- `POLAR_SERVER=sandbox` and sandbox keys (separate from production).
- Polar must reach our webhook URL, so the sandbox is tested on the **staging deployment** (or through a tunnel such as
  `cloudflared` pointed at a local server). Day-to-day local work uses the fake provider.
- Before going live, the owner runs the checklist: buy with a sandbox card, buy with a 20% coupon,
  refund partially, refund fully, send the same webhook twice from the Polar dashboard ("redeliver").

---

## 10. Environment variables added by this doc

| Name | Example | Notes |
|---|---|---|
| `PAYMENT_PROVIDER` | `polar` or `fake` | `fake` is refused when `NODE_ENV=production`. |

(`POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER` are already in `02-architecture.md` section 10.)

---

## 11. Required tests

These are the minimum. Each task that builds part of this doc copies the relevant rows into its `Required tests`.
All service tests run against the in-memory MongoDB (`10-testing.md`).

**Coupon quote**
- Each of the 6 checks fails with its exact message; checks run in order (e.g. an expired **and** inactive coupon returns "not valid").
- Percent and fixed calculations, including rounding (`Math.round`) and the 100-cent minimum.

**Card checkout**
- Refuses unpublished theme, already-owned theme, invalid coupon, missing product id (exact messages).
- Passes `userId`, `themeId`, `couponId` metadata and the discount id to the provider (checked on the fake provider's recorded call).

**processPaymentEvent — order paid**
- Creates exactly one order, one active ownership, `salesCount + 1`, coupon `redemptionsCount + 1`, one `order_paid` log.
- The **same event twice** → still exactly one order, `salesCount` and `redemptionsCount` increased only once.
- **Two different events** for the same provider order id → one order.
- Revoked ownership is re-activated and linked to the new order.
- Already-active ownership stays unchanged; the order is still saved.
- Unknown `themeId` → event `failed`, no order, permanent (HTTP 200).
- `currency: "eur"` → `failed`, no order.

**processPaymentEvent — refund**
- Partial refund → `partially_refunded`, ownership still active, `salesCount` unchanged.
- Full refund → `refunded`, ownership revoked with reason `refund`, `salesCount − 1`.
- Full refund does **not** revoke an ownership that belongs to a different order or an admin grant.
- Refund for an unknown order → temporary failure (HTTP 500 path).

**Webhook handler (Polar provider, real signature)**
- A payload signed with the test secret → 200 and processed.
- Wrong signature → 403, nothing written.
- An event type we don't handle → 200, `ignored`.

**Wallet**
- `amountEgp` examples from 7.2.
- Start: refused for non-EG country, wallet disabled, owned theme; returns the existing open request instead of creating a second.
- Submit: wrong phone format, proof key of another request, missing object in storage → exact messages.
- Approve: creates order (`egp`, amounts × 100), ownership, notification, log; approving twice → `"This payment was already reviewed."` and still one order.
- Reject: requires reason; customer can start a new request afterwards.
- Mark as refunded: revokes ownership, `salesCount − 1`; refused for card orders.

**Fake provider E2E** (Playwright, `10-testing.md`)
- Register → verify → buy with coupon via fake checkout → success page → download link works.
