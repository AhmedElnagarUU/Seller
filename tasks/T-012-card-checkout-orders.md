# T-012: Card checkout, Polar webhook, orders (and the fake checkout)

- Depends on: T-001 – T-011
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2, 5, 6, 7, 9; `docs/03-data-model.md` sections 7, 8, 15, 16, 19 (both "Polar webhook" lists);
  `docs/06-payments.md` sections 2, 4, 5, 6, 8, 11; `docs/09-emails.md` sections 1.3, 2, 3 (#3); `docs/05-pages.md` sections 1, 4 (`/account/orders`);
  `docs/10-testing.md` sections 2, 4, 8 (flow 2); `docs/01-decisions.md` D-031, D-034, D-035, D-103.
  Pattern to copy: `src/features/themes/*` (service/repository/actions), `src/features/auth/auth.actions.ts` (actions that redirect).

## Goal

A customer can pay by card (Polar, or the fake provider locally and in E2E), and the payment becomes an order and an
ownership **only** through the webhook code path `processPaymentEvent` (D-034). Also the success page, the account
orders list, and the order confirmation email.

**Not in this task**: wallet payments, settings, the wallet option on the checkout page (T-013); the admin orders
pages and "Mark as refunded" (T-018). The wallet section of `/account/orders` is added by T-013.

## Contract: functions of earlier tasks that this task calls

Use these names. If the merged code spells one differently, use the real name and do **not** rename it. Ids are strings.

| Name | File | From |
|---|---|---|
| `activityService.log(input, session?)` — `input: ActivityLogInput` = `{ action, actorRole, actorUserId?, subjectUserId?, targetType?, targetId?, summary }`; omitted nullable fields are saved as `null`; a `system` entry **must not** have an `actorUserId` (omit it); with a `session` every error is thrown; `summary` 2–300 characters | `features/activity/activity.service.ts` | T-005 |
| `ownershipService.grantFromOrder({ userId, themeId, orderId }, session)` — creates the ownership, or re-activates a **revoked** one (same document: `status "active"`, `source "purchase"`, new `orderId`, all `revoked*` and `grant*` fields `null`); an **already active** ownership is left unchanged (03 §8) | `features/ownerships/ownership.service.ts` | T-009 |
| `ownershipService.revokeForRefund({ userId, themeId, orderId }, session)` — revokes (`revokedReason "refund"`, `revokedAt` now) **only** when the ownership is `active` and its `orderId` equals `orderId`; otherwise does nothing | same | T-009 |
| `hasActiveOwnership(userId, themeId)` | same | T-009 |
| `DownloadButton({ versionId, label, size?, variant? })` — a plain `<a href="/api/downloads/<versionId>">` (never a `Link`) | `features/downloads/components/DownloadButton.tsx` | T-009 |
| `listVersionsForTheme(themeId)` → newest first, each has `id`, `version` | `features/versions/version.service.ts` | T-008 |
| `createOwnership(userId, themeId, overrides?)`, `createVersion(themeId, overrides?)` factories | `shared/test/factories.ts` | T-009 / T-008 |
| `createZipFile(fileName, content): Buffer`, `putStoredFile({ bucket, key, contentType, body })`, `readMongoUri`, `registerAs(page, email)` (registers with country EG), `removeAdminAccount`, `ADMIN_EMAIL` (e2e) | `e2e/helpers.ts` | T-008 / T-009 / T-005 |
| `OwnershipModel`, `ActivityLogModel` (tests read them) | their `*.model.ts` | T-009 / T-005 |
| `couponService.quote`, `ensureDiscountId`, `recordRedemption`, `getCouponSummary`, factory `createCoupon` | `features/coupons/…` | T-011 |
| `getPaymentProvider`, `fakePaymentProvider`, `createFakeProvider`, `createPolarProvider`, `signPolarWebhook`, `WebhookSignatureError`, `WebhookPayloadError`, `PaymentEvent` | `features/payments/…`, `shared/test/…` | T-010 |
| `isDuplicateKeyError` | `shared/db/duplicate-key.ts` | T-011 |
| `getCountryOptions()`, `isCountryCode` | `shared/lib/countries.ts` | T-003 |
| `userService.setUserCountry(userId, country)` | `features/users/user.service.ts` | T-003 |

## Packages / env

None. (`PAYMENT_PROVIDER` exists since T-010; E2E runs with `fake`.)

## Files

```
src/features/orders/
  order.model.ts / order.repository.ts / order.service.ts / order.mapper.ts / order.schemas.ts / order.types.ts / order.constants.ts
  order.service.test.ts / order.mapper.test.ts / order.schemas.test.ts
  components/OrderTable.tsx
src/features/payments/
  webhook-event.model.ts / webhook-event.repository.ts / webhook-event.constants.ts
  payment-event.service.ts / payment-event.service.test.ts       processPaymentEvent()
  payment.webhook.ts / payment.webhook.test.ts                   handlePaymentWebhook()
  checkout.service.ts / checkout.service.test.ts / checkout.actions.ts / checkout.schemas.ts / checkout.schemas.test.ts / checkout.constants.ts / checkout.types.ts
  fake/fake.provider.ts                                          (change) add simulateFakeRefund
  components/CheckoutSummary.tsx, CouponField.tsx, CardCheckoutForm.tsx ("use client"), CountryForm.tsx ("use client"),
             SuccessWaiting.tsx ("use client"), FakeCheckoutForm.tsx ("use client")
src/features/emails/templates/OrderConfirmationEmail.tsx
src/features/emails/email.service.ts / email.service.test.ts     (change) sendOrderConfirmationEmail + tests
src/features/themes/theme.repository.ts / theme.service.ts / theme.types.ts   (change) getThemeForPurchase, getThemeForPurchaseById, adjustSalesCount
src/features/themes/theme.service.test.ts                        (change) add tests
src/features/users/user.repository.ts / user.service.ts / user.types.ts / user.service.test.ts   (change) getUserSummary
src/shared/test/factories.ts                                     (change) createOrder(overrides?)
src/app/api/webhooks/polar/route.ts
src/app/checkout/[slug]/page.tsx
src/app/checkout/success/page.tsx
src/app/checkout/fake/[checkoutId]/page.tsx
src/app/account/orders/page.tsx
e2e/helpers.ts                                                   (change) add markEmailVerified, seedPublishedThemeWithZip
e2e/checkout.spec.ts
```

## Models

- `order.model.ts`: exactly 03 §7 — every field, `themeSnapshot` and `provider` sub-documents with `{ _id: false }`, all 6 indexes (the first one unique). Enums in `order.constants.ts`:
  `ORDER_METHODS = ["card", "wallet"]`, `ORDER_STATUSES = ["paid", "partially_refunded", "refunded"]`, `ORDER_CURRENCIES = ["usd", "egp"]`, `ORDER_PROVIDER_NAMES = ["polar", "fake", "manual_wallet"]`.
  Amounts are integers ≥ 0 (`validate: Number.isInteger`, `min: 0`). **Do not** add a `maxlength` to `themeSnapshot.name` (03 §7 has none; a test depends on it). `OrderRecord` via `InferSchemaType`.
- `webhook-event.model.ts`: exactly 03 §16 (collection `webhookEvents`; `provider` enum `polar | fake`; `status` enum `processing | processed | ignored | failed`; `error` max 1000; both indexes — the unique one on `{ provider, eventId }` and the TTL index `{ createdAt: 1 }` with `expireAfterSeconds: 7776000`).
  Constants in `webhook-event.constants.ts`: `WEBHOOK_EVENT_STATUSES`, `WEBHOOK_PROVIDERS`, `WEBHOOK_TYPE_MAX = 100`, `WEBHOOK_ERROR_MAX = 1000`. `WebhookEventRecord` via `InferSchemaType`.

## Messages

`checkout.constants.ts` — **exact text from 06 §5.3**:

| Key | Text |
|---|---|
| `themeUnavailable` | `This theme is not available.` |
| `alreadyOwned` | `You already own this theme.` |
| `cardUnavailable` | `Card payment is not available for this theme right now. Please try again later.` |

Event-processing messages (stored in `webhookEvents.error`; the docs say "store message" but give no texts) — `[PLANNER: confirm]` — in `order.constants.ts` (`ORDER_EVENT_MESSAGES`) and `webhook-event.constants.ts`:

| Key | Text | Used when |
|---|---|---|
| `invalidUser` | `The payment event has no valid user.` | `userId` is empty, not an id, or no such user (permanent) |
| `invalidTheme` | `The payment event has no valid theme.` | `themeId` is empty, not an id, or no such theme (permanent) |
| `wrongCurrency` | `The payment currency is not USD.` | `currency !== "usd"` (permanent) |
| `temporaryFailure` | `Temporary error. The event will be retried.` | any other error (temporary) |
| `refundOrderMissing` | `The order for this refund was not found yet. The event will be retried.` | refund before its `order.paid` (temporary) |
| `simulateFailed` | `The test payment could not be processed.` | fake checkout (shown to the developer) |

`[PLANNER: coupon id of a paid order that is not a valid or known coupon. The docs list only user, theme and currency as permanent errors. Recommended: save the order WITHOUT a coupon (couponId and couponCode null, amounts from Polar) — money was taken, so the order must not be lost. Confirm.]`

## Order service (`order.service.ts`) — 03 §7, §19

All writes of one event run in the transaction that `processPaymentEvent` opens: these functions take the `session`.

| Function | Rules |
|---|---|
| `recordCardOrder(order: NormalizedOrder, providerName: ProviderName, session): Promise<{ outcome: "created"; orderId: string } \| { outcome: "already_recorded" }>` | Checks, in this order, each throws `AppError("INVALID", <message>)` (permanent): (1) `userService.getUserSummary(order.userId)` is `null` → `invalidUser`; (2) `themeService.getThemeForPurchaseById(order.themeId)` is `null` → `invalidTheme`; (3) `order.currency !== "usd"` → `wrongCurrency`. Then: (4) an order with `provider.name = providerName` and `provider.orderId = order.providerOrderId` already exists (`findOrderByProvider(..., session)`) → return `{ outcome: "already_recorded" }` and write nothing. (5) Coupon: `couponId` null → none; otherwise `couponService.getCouponSummary(couponId)`, `null` → treat as no coupon. (6) Insert the order: `method "card"`, `status "paid"`, `currency "usd"`, amounts and `paidAt` from the event, `refundedAmount 0`, `themeSnapshot { name, slug }` from the theme, `couponId` / `couponCode`, `walletPaymentId null`, `provider { name: providerName, orderId, checkoutId, customerId }`, `refundedAt null`. (7) `ownershipService.grantFromOrder({ userId, themeId, orderId }, session)`. (8) `themeService.adjustSalesCount(themeId, 1, session)`; with a coupon `couponService.recordRedemption(couponId, session)`. (9) `activityService.log({ action: "order_paid", actorRole: "system", subjectUserId: userId, targetType: "order", targetId: orderId, summary: "Order paid: <Theme name> (<formatPrice(totalAmount, "usd")>)" }, session)`. Return `{ outcome: "created", orderId }`. |
| `recordRefund({ providerName, providerOrderId, refundedAmount, isFullRefund }, session): Promise<{ outcome: "order_not_found" \| "unchanged" \| "partially_refunded" \| "refunded" }>` | Order not found → `{ outcome: "order_not_found" }`. Order already `refunded` → `{ outcome: "unchanged" }` (`refunded` is final). `isFullRefund` → `applyFullRefund(order, refundedAmount, session)`, outcome `"refunded"`. Otherwise (partial): update `status "partially_refunded"` and `refundedAmount`; no ownership change, no `salesCount` change, no log; outcome `"partially_refunded"`. |
| `applyFullRefund(order, refundedAmount, session): Promise<void>` (exported: T-018 reuses it) | Update the order: `status "refunded"`, `refundedAmount`, `refundedAt = now()`. `ownershipService.revokeForRefund({ userId, themeId, orderId }, session)` (it only revokes when the ownership belongs to this order). `themeService.adjustSalesCount(themeId, -1, session)`. `activityService.log({ action: "order_refunded", actorRole: "system", subjectUserId: userId, targetType: "order", targetId: orderId, summary: "Order refunded: <Theme name> (<formatPrice(totalAmount, currency)>)" }, session)`. |
| `listOrdersForUser(userId, page): Promise<OrderPageDTO>` | The user's orders, newest first (`createdAt` desc, `_id` desc), `ORDERS_PER_PAGE = 20`. `{ items: OrderListItemDTO[], page, totalPages, total }`. Page numbers below 1 count as 1. |
| `getOrderForCheckout(userId, checkoutId): Promise<OrderSuccessDTO \| null>` | The order with `provider.checkoutId = checkoutId` **and** `userId` (another user's order gives `null`). `{ id, themeId, themeName, themeSlug }`. |
| `getOrderForEmail(orderId): Promise<OrderEmailDTO \| null>` | `{ id, userId, themeName, paidAt, totalAmount, discountAmount, currency, couponCode }`; `null` for an invalid or unknown id. |

`OrderListItemDTO = { id, paidAt, themeName, themeSlug, method, status, totalAmount, currency }`. Labels in `order.constants.ts`:
`ORDER_STATUS_LABELS = { paid: "Paid", partially_refunded: "Partly refunded", refunded: "Refunded" }`,
`ORDER_STATUS_TONES = { paid: "success", partially_refunded: "warning", refunded: "neutral" }`,
`ORDER_METHOD_LABELS = { card: "Card", wallet: "Wallet" }`.

Repository (`order.repository.ts`, `connectDB()` first, writes take `session`): `insertOrder(fields, session)`, `findOrderByProvider(providerName, providerOrderId, session?)`,
`findOrderById(id)` (invalid id → `null`), `findOrderByCheckoutId(userId, checkoutId)`, `updateOrderRefund(id, { status, refundedAmount, refundedAt }, session)`,
`findOrdersForUser(userId, page, pageSize)`, `countOrdersForUser(userId)`.

## Other services this task extends

| Service | New function | Rules |
|---|---|---|
| `theme.service.ts` | `getThemeForPurchase(slug): Promise<ThemePurchaseDTO \| null>` and `getThemeForPurchaseById(id): Promise<ThemePurchaseDTO \| null>` | Any status. `null` for unknown slug, or an invalid / unknown id. `ThemePurchaseDTO = { id, slug, name, tagline, status, priceCents, providerProductId: string \| null }` (in `theme.types.ts`) |
| `theme.service.ts` | `adjustSalesCount(themeId, delta: 1 \| -1, session): Promise<void>` | `$inc` of `stats.salesCount` (repository function with the same name) |
| `user.service.ts` | `getUserSummary(userId): Promise<UserSummary \| null>` | `UserSummary = { id, name, email, country: string \| null }` in `user.types.ts`. `null` for an invalid or unknown id (use `parseObjectId`; the existing `findUserById` throws for invalid ids, so add `findUserSummaryById` to `user.repository.ts`) |

## `processPaymentEvent` (`payment-event.service.ts`) — 06 §6.3, 03 §19

```ts
export type PaymentEventOutcome = "processed" | "ignored" | "duplicate" | "permanent_failure" | "temporary_failure";
// The ONE place that turns a payment event into database changes. Never throws.
export async function processPaymentEvent(event: PaymentEvent, providerName: ProviderName): Promise<PaymentEventOutcome>
```
`[PLANNER: 06 §6.3 shows processPaymentEvent(event). It needs the provider name for webhookEvents.provider and orders.provider.name, and a typed result for the HTTP status. Recommended: this signature. Confirm.]`

Steps:
1. **Claim** (`webhook-event.repository.ts`: `insertProcessingEvent`, `findEvent`, `setEventStatus`, `markProcessed`, `markFailed`): insert `{ provider: providerName, eventId: event.eventId, type: event.type.slice(0, 100), status: "processing" }`.
   If the insert fails with a duplicate-key error (`isDuplicateKeyError`): read the existing row. `processed` or `ignored` → return `"duplicate"` (nothing else happens). `processing` or `failed` → set it to `processing` (`error` `null`) and continue: this is a retry. (A missing row after a duplicate-key error → `throw new Error("webhook event row missing")`.) Any other insert error → return `"temporary_failure"` (log it).
2. `event.kind === "ignored"` → status `ignored`, `processedAt = now()`, return `"ignored"`.
3. `order_paid`: `withTransaction(async (session) => { const result = await recordCardOrder(event.order, providerName, session); await markProcessed(rowId, now(), session); return result; })`.
   `order_refunded`: `withTransaction(...)` with `recordRefund({ providerName, providerOrderId: event.providerOrderId, refundedAmount: event.refundedAmount, isFullRefund: event.isFullRefund }, session)`; when the outcome is `"order_not_found"` do **not** call `markProcessed` (the transaction commits nothing).
4. The refund outcome `"order_not_found"` → `markFailed(rowId, refundOrderMissing)`; `console.error("payment event failed", { eventId, type })`; return `"temporary_failure"` (the `order.paid` webhook may not be processed yet; Polar retries).
5. A thrown `AppError` (permanent: bad user / theme / currency) → `markFailed(rowId, error.message)`, `console.error("payment event failed", { eventId, type, message })`, return `"permanent_failure"`.
   Any other thrown error → `markFailed(rowId, temporaryFailure)`, `console.error` with the same fields (message only, never the event or order body), return `"temporary_failure"`.
6. After a successful `order_paid` transaction whose outcome was `"created"` (not for `already_recorded`): `try { await sendOrderConfirmationEmail({ orderId }) } catch (error) { console.error("sendOrderConfirmationEmail failed", error) }`. The email never changes the outcome.
7. Return `"processed"`.

Never log the webhook body (06 §6.4): only `eventId`, `type` and our message.

## Webhook handler (`payment.webhook.ts`) and route

```ts
// Uses only the standard Request / Response types, so it can move to Express (06 §1).
export async function handlePaymentWebhook(request: Request, provider: PaymentProvider = getPaymentProvider()): Promise<Response>
```
`[PLANNER: the second parameter is only there so tests can pass the real Polar provider (the global test fake replaces getPaymentProvider). The route never passes it. Confirm.]`

| Step | Action | Response |
|---|---|---|
| 1 | `rawBody = await request.text()` | |
| 2 | `event = await provider.parseWebhook(rawBody, request.headers)` | `WebhookSignatureError` → `Response.json({ error: "Invalid signature" }, { status: 403 })`; `WebhookPayloadError` → `Response.json({ error: "Invalid body" }, { status: 400 })`; any other error → `console.error("payment webhook failed", message)` + `Response.json({ error: "Temporary failure" }, { status: 500 })` |
| 3 | `outcome = await processPaymentEvent(event, provider.name)` | `"temporary_failure"` → `Response.json({ error: "Temporary failure" }, { status: 500 })` |
| 4 | otherwise (`processed`, `ignored`, `duplicate`, `permanent_failure`) | `Response.json({ received: true }, { status: 200 })` |

`src/app/api/webhooks/polar/route.ts`: `import { handlePaymentWebhook } from "@/features/payments/payment.webhook"; export async function POST(request: Request) { return handlePaymentWebhook(request); }` — nothing else.

## Fake provider additions (`fake/fake.provider.ts`) — 06 §8

```ts
// Test helper (no page uses it): turns a provider order into a refund event and processes it like a webhook.
export async function simulateFakeRefund(providerOrderId: string, isFullRefund: boolean): Promise<PaymentEventOutcome>
```
Builds `{ kind: "order_refunded", eventId: "fake_evt_refund_" + providerOrderId + "_" + (isFullRefund ? "full" : "partial"), type: "order.refunded", providerOrderId, refundedAmount, isFullRefund }` and calls `processPaymentEvent(event, "fake")`.
`refundedAmount` = the order's `totalAmount` for a full refund, and `Math.floor(totalAmount / 2)` for a partial one: look the order up with `orderService` (add `getRefundBase(providerName, providerOrderId): Promise<number | null>` returning the `totalAmount`; unknown order → use `0`, so the refund ends as `order_not_found`).

## Checkout (`checkout.service.ts`) — 06 §5

```ts
export type CheckoutPageData =
  | { kind: "not_found" }
  | { kind: "owned" }
  | { kind: "ready"; theme: CheckoutThemeDTO; couponCode: string | null; quote: CouponQuote | null; couponError: string | null; finalPriceCents: number };
// CheckoutThemeDTO = { id, slug, name, tagline, priceCents }   (checkout.types.ts)
```

| Function | Rules |
|---|---|
| `getCheckoutPageData(userId, slug, couponCode: string \| null): Promise<CheckoutPageData>` | Theme missing or `status !== "published"` → `not_found`. `hasActiveOwnership` → `owned`. A non-empty (trimmed) `couponCode` → `couponService.quote({ themeId, priceCents, code })`; on `AppError` return `couponError = error.message`, `quote = null`; any other error is rethrown. `finalPriceCents = quote?.finalCents ?? priceCents`. |
| `startCardCheckout({ userId, customerEmail, customerName, themeSlug, couponCode }): Promise<{ url: string }>` | Exactly the 7 steps of 06 §5.3, in this order: (1) theme exists and is published, else `AppError("NOT_FOUND", themeUnavailable)`; (2) no active ownership, else `AppError("CONFLICT", alreadyOwned)`; (3) non-empty `couponCode` → `quote`, failure → `AppError("INVALID", <the coupon message>)`; (4) `providerProductId` not `null`, else `console.error("card checkout: theme has no provider product", themeId)` and `AppError("INVALID", cardUnavailable)`; (5) when a coupon is used: `couponService.ensureDiscountId(couponId)`, `null` → same error as step 4 (with `console.error`); (6) `getPaymentProvider().createCheckout({ productId, discountId, userId, themeId, couponId, customerEmail, customerName, successUrl: env.APP_URL + "/checkout/success?checkout_id={CHECKOUT_ID}" })`; a thrown error → `console.error("card checkout: createCheckout failed", error)` and the same `AppError("INVALID", cardUnavailable)`; (7) return `{ url }`. `discountId` and `couponId` are `null` without a coupon. |
| `getFakeCheckoutData({ themeId, couponId }): Promise<FakeCheckoutDTO \| null>` | For the fake page. `FakeCheckoutDTO = { themeName, subtotalCents, discountCents, totalCents, couponCode: string \| null }`. `null` when the theme is unknown / invalid, or the coupon id is not empty and unknown or its `quote` throws. |
| `simulateFakePayment({ userId, checkoutId, themeId, couponId }): Promise<void>` | Builds and processes the `order_paid` event of 06 §8: `eventId "fake_evt_" + checkoutId`, `providerOrderId "fake_ord_" + checkoutId`, `checkoutId`, `providerCustomerId null`, `userId` (from the session, never from the URL), `themeId`, `couponId` (`null` when `""`), `currency "usd"`, `subtotalAmount` = theme price, `discountAmount` / `totalAmount` from `couponService.quote` (no coupon: 0 / price), `taxAmount 0`, `paidAt = now()`. Calls `processPaymentEvent(event, "fake")`. Outcome not `"processed"` or `"duplicate"` → `AppError("INVALID", simulateFailed)`. Unknown theme → `AppError("NOT_FOUND", themeUnavailable)`. |

## Actions (`checkout.actions.ts`) — 02 §5.5

| Action | Signature | Rules |
|---|---|---|
| `applyCouponAction` | `(formData: FormData): Promise<void>` | `requireVerifiedUser("/checkout/<slug>")`. Reads `slug` and `code` (`applyCouponSchema`). Bad slug → `redirect("/themes")`. `redirect("/checkout/" + slug + (code ? "?coupon=" + encodeURIComponent(code) : ""))`. It does not check the coupon: the page does. |
| `startCardCheckoutAction` | `(_previous, formData): Promise<ActionResult>` | `requireVerifiedUser`; `startCardCheckoutSchema` on `slug` and `coupon` (hidden field, `""` → `null`); `startCardCheckout({ userId: user.id, customerEmail: user.email, customerName: user.name, themeSlug, couponCode })` in `try/catch` (`failureFrom`); then `redirect(url)` **outside** the `try`. |
| `setCountryAction` | `(_previous, formData): Promise<ActionResult>` | `requireVerifiedUser`; `setCountrySchema` (`slug`, `country`, `coupon`); `userService.setUserCountry(user.id, country)` (an invalid code gives the service's `"Please choose your country."`); then `redirect` to the same checkout path (with `?coupon=` when set). |
| `simulateFakePaymentAction` | `(_previous, formData): Promise<ActionResult>` | **First line:** `if (env.PAYMENT_PROVIDER !== "fake") notFound();`. `requireVerifiedUser`; `simulateFakePaymentSchema` (`checkoutId`, `themeId`, `couponId`); `simulateFakePayment(...)`; `redirect("/checkout/success?checkout_id=" + checkoutId)`. |

`checkout.schemas.ts` (zod; invalid input is a validation failure, never a crash):
- `slug`: `THEME_SLUG_PATTERN` (from `theme.constants.ts`); `code` / `coupon`: trimmed, cut to 64 characters; `country`: any string (the service validates); `checkoutId`: `^[A-Za-z0-9_-]{1,100}$`; `themeId`, `couponId`: `OBJECT_ID_PATTERN` or `""` for the coupon.
- `checkoutSearchParamsSchema`: `{ coupon: z.string().trim().max(64).catch("") }` (a bad value falls back to `""`, 05 §1.4).
- `checkoutSuccessSearchParamsSchema`: `{ checkout_id: <checkoutId rule>.optional().catch(undefined) }`.

## Pages

All pages export `metadata` with `robots: { index: false }`; titles `Checkout · Theme Store`, `Payment · Theme Store`, `Orders · Theme Store`.

| URL | Behaviour |
|---|---|
| `/checkout/[slug]?coupon=` | `requireVerifiedUser("/checkout/<slug>")`. `user.country === null` → show `CountryForm` only (06 §5.2). Else `getCheckoutPageData`: `not_found` → `notFound()`; `owned` → `redirect("/account/themes")`; `ready` → `PageContainer width="narrow"` with `CheckoutSummary`, `CouponField`, and `CardCheckoutForm`. |
| `/checkout/success?checkout_id=` | `requireUser("/checkout/success")`. Invalid or missing `checkout_id` → `redirect("/account/orders")`. `getOrderForCheckout(user.id, checkoutId)`: found → Heading 1 `Thank you! <Theme> is yours.`, `DownloadButton` (`versionId` and `label` `"Download <version>"`) for the newest version of `listVersionsForTheme(order.themeId)` (no button when the theme has no version), `TextLink` `My themes` → `/account/themes`. Not found → `SuccessWaiting`. |
| `/checkout/fake/[checkoutId]?theme=&coupon=` | **First line:** `if (env.PAYMENT_PROVIDER !== "fake") notFound();`. `requireVerifiedUser("/checkout/fake/<checkoutId>")`. `getFakeCheckoutData` `null` → `notFound()`. Shows `FakeCheckoutForm`. |
| `/account/orders?page=` | `requireUser("/account/orders")`. `listOrdersForUser(user.id, page)` → Heading 1 `Orders`, `OrderTable`, `Pagination` (keeps no other params). Empty: `Text` `No orders yet.` (a page above `totalPages` shows it too). Rendered inside the same account shell that `/account/themes` uses (T-009): do not render a second shell. |

Components (layout classes only; visual look comes from the UI kit):
- `CheckoutSummary` (props `theme`, `quote`, `finalPriceCents`): Heading 2 = theme name, `Text tone="muted"` tagline, a row `Price` / `formatPrice(priceCents, "usd")`; with a quote a row `Coupon <CODE>` / `−<formatPrice(discountCents, "usd")>` (the minus sign is `−`, U+2212); a bold row `Total` / `formatPrice(finalPriceCents, "usd")`.
- `CouponField` (props `slug`, `couponCode`, `error`): `<form action={applyCouponAction}>` with hidden `slug`, `TextField` label `Coupon code` name `code` (default = `couponCode ?? ""`), `SubmitButton variant="secondary"` `Apply` / `Applying…`; `Alert tone="danger"` with `error` when set; with a valid coupon `Text tone="success"` `Coupon applied.`.
- `CardCheckoutForm` (`"use client"`, props `slug`, `couponCode`): `useActionState(startCardCheckoutAction, null)`; hidden `slug`, hidden `coupon`; `FormError`; `SubmitButton` `Continue to payment` / `Redirecting…`.
- `CountryForm` (`"use client"`, props `slug`, `couponCode`): Heading 2 `Choose your country`, `Text` `We use it to show you the right payment options.`, `SelectField` label `Country` name `country` with `getCountryOptions()` and `placeholder="Choose your country"`, hidden `slug` and `coupon`, `SubmitButton` `Continue` / `Saving…`.
- `SuccessWaiting` (`"use client"`): Heading 1 `Confirming your payment…`. A `useEffect` with a 3000 ms `setTimeout` calls `router.refresh()` and counts the attempts; **at most 10** refreshes. After the 10th, show `Text` `Your payment is being confirmed. This can take a few minutes. We'll email you as soon as your theme is ready.` instead of the heading and stop refreshing.
- `FakeCheckoutForm` (`"use client"`, props `checkoutId`, `themeId`, `couponId`, `data`): Heading 1 `Fake checkout (test mode)`, the summary rows, hidden fields, `FormError`, `SubmitButton` `Simulate successful payment` / `Processing…`.
- `OrderTable`: shared `Table`; columns `Date` (`formatDate(paidAt)`), `Theme` (`TextLink` to `/themes/<slug>`), `Method`, `Total` (`formatPrice(totalAmount, currency)`), `Status` (`Badge` with the label and tone constants).

`[PLANNER: headings, labels and helper texts of the checkout, country, success-waiting and fake pages are not in the docs, except "Continue to payment" (00 §3.3), "Thank you! <Theme> is yours.", "Confirming your payment…", the "Your payment is being confirmed…" text (06 §5.4), "Simulate successful payment" (06 §8), the order table columns and "No orders yet." (05 §4). Confirm all others.]`

## Email #3 (`OrderConfirmationEmail`, `sendOrderConfirmationEmail`) — 09 §3

`sendOrderConfirmationEmail({ orderId }): Promise<void>` in `email.service.ts`: `orderService.getOrderForEmail(orderId)` (missing → `AppError("NOT_FOUND", "Order not found.")`), `userService.getUserSummary(order.userId)` (missing → same error), render, `getEmailSender().send({ to: user.email, subject: "Your purchase: <Theme>", html, text, templateName: "OrderConfirmationEmail" })`.
Content (inside `EmailLayout`, no settings line): `Hi <Name>,` / `Thank you for buying **<Theme>**. It is now in your account, with free updates for life.` / `Order: <order id> · Date: <formatDate(paidAt)> · Paid: <formatPrice(totalAmount, currency)>` / only when `discountAmount > 0`: `Coupon <code>: −<formatPrice(discountAmount, currency)>` / button `Download your theme` → `env.APP_URL + "/account/themes"` / `Your receipt from our payment partner Polar was sent in a separate email.`
No link to `/api/downloads/...` (09 §1.3).

## Test factory

`createOrder(overrides?: Partial<Omit<OrderRecord, "_id">>)` in `factories.ts`: creates a user (`createUser()`) when `userId` is missing and a published theme (`createTheme({ status: "published" })`) when `themeId` is missing; `themeSnapshot` from that theme. Defaults: `method "card"`, `status "paid"`, `currency "usd"`, `subtotalAmount 2900`, `discountAmount 0`, `taxAmount 0`, `totalAmount 2900`, `refundedAmount 0`, `couponId null`, `couponCode null`, `walletPaymentId null`, `provider { name: "polar", orderId: "order_" + n, checkoutId: null, customerId: null }`, `paidAt: now()`, `refundedAt: null`.

## Required tests

In every test file below, build events with a local helper `buildPaidEvent(overrides)` — a valid `order_paid` event: `eventId "evt_1"`, `type "order.paid"`, order `{ providerOrderId "po_1", checkoutId "chk_1", providerCustomerId "cus_1", userId, themeId, couponId, currency "usd", subtotalAmount 2900, discountAmount 580, taxAmount 0, totalAmount 2320, paidAt 2026-11-01T10:00:00Z }`.
Use a published theme with `priceCents 2900` and `provider.productId "fake_prod_x"`; coupon `createCoupon({ percentOff: 20 })`; `setTestNow(new Date("2026-11-01T10:00:00Z"))`.

`payment-event.service.test.ts` — order paid
- [ ] processPaymentEvent › order paid creates exactly one order, one active ownership, `salesCount + 1`, coupon `redemptionsCount + 1`, one `order_paid` log → outcome `"processed"`; order has `method "card"`, `status "paid"`, amounts 2900 / 580 / 0 / 2320, `couponCode`, `themeSnapshot`, `provider { name "fake", orderId "po_1", checkoutId "chk_1", customerId "cus_1" }`; ownership `source "purchase"` with `orderId` = the order; log has `actorRole "system"`, `subjectUserId` = buyer, `targetType "order"`, summary `"Order paid: <Theme name> ($23.20)"`; webhook event `processed` with `processedAt` = now
- [ ] processPaymentEvent › the same event twice → 2nd outcome `"duplicate"`; still 1 order, 1 ownership, `salesCount 1`, `redemptionsCount 1`, 1 log, 1 confirmation email
- [ ] processPaymentEvent › two different events for the same provider order id → 1 order; the 2nd outcome is `"processed"`; `salesCount 1`; 1 email
- [ ] processPaymentEvent › re-activates a revoked ownership and links it to the new order → the same ownership `_id`, `status "active"`, `orderId` = new order, `revokedAt`, `revokedReason`, `revokeNote` null; still 1 ownership
- [ ] processPaymentEvent › keeps an already active ownership unchanged and still saves the order (admin grant: `source "admin_grant"`, `orderId` null stay) → 1 order, `salesCount 1`
- [ ] processPaymentEvent › unknown theme id → `"permanent_failure"`; 0 orders, 0 ownerships; webhook event `failed` with error `"The payment event has no valid theme."`
- [ ] processPaymentEvent › empty or invalid theme id (`""`, `"not-an-id"`) → `"permanent_failure"` with the same error
- [ ] processPaymentEvent › empty, invalid or unknown user id → `"permanent_failure"`, error `"The payment event has no valid user."`
- [ ] processPaymentEvent › currency `"eur"` → `"permanent_failure"`, error `"The payment currency is not USD."`; 0 orders
- [ ] processPaymentEvent › an event left in status `processing` (a crash before the end) is processed when it arrives again → insert the webhook event row with `status "processing"` first; outcome `"processed"`; 1 order; the row is `processed`
- [ ] processPaymentEvent › a coupon id that does not exist saves the order without coupon (`couponId null`, `couponCode null`) and counts no redemption
- [ ] processPaymentEvent › rolls back everything when a write fails: make the theme name 400 characters long with `ThemeModel.collection.updateOne({ _id }, { $set: { name: "x".repeat(400) } })` (bypasses validation) so the `order_paid` log summary exceeds 300 characters → outcome `"temporary_failure"`; 0 orders, 0 ownerships, `salesCount 0`, `redemptionsCount 0`; webhook event `failed` with `"Temporary error. The event will be retried."`
- [ ] processPaymentEvent › sends the confirmation email after the commit: 1 email to the buyer, subject `"Your purchase: <Theme name>"`; an email failure (`fakeEmailSender.failNext`) does not change the outcome (`"processed"`) or the data (1 order)
- [ ] processPaymentEvent › an ignored event is stored with status `ignored` and writes nothing else; the same event again → `"duplicate"`

`payment-event.service.test.ts` — refund (first create the order with `createOrder` + `createOwnership` linked to it, `salesCount 1`)
- [ ] processPaymentEvent › partial refund → order `partially_refunded`, `refundedAmount 500`; ownership still `active`; `salesCount` still 1; no `order_refunded` log
- [ ] processPaymentEvent › full refund → order `refunded`, `refundedAmount 2320`, `refundedAt` now; ownership `revoked` with `revokedReason "refund"`; `salesCount 0`; one `order_refunded` log with summary `"Order refunded: <Theme name> ($29.00)"` (the order's `totalAmount`)
- [ ] processPaymentEvent › full refund does not revoke an ownership that belongs to another order or an admin grant → ownership still `active`; the order is still `refunded`; `salesCount 0`
- [ ] processPaymentEvent › refund for an unknown order → `"temporary_failure"`; webhook event `failed`; nothing else written
- [ ] processPaymentEvent › the same refund event is accepted after its order exists (Polar's retry): first `"temporary_failure"`, then process the paid event, then the refund event with the same event id → `"processed"`; order `refunded`
- [ ] processPaymentEvent › the same refund event twice → 2nd `"duplicate"`; `salesCount` decreased once
- [ ] processPaymentEvent › a second full refund event (new event id) for an already refunded order → `"processed"`, nothing changes (`salesCount` stays 0); a partial refund event after a full one does not change the status
- [ ] simulateFakeRefund › refunds a fake order fully and partially through the same code path → statuses `refunded` / `partially_refunded` (`Math.floor(2320 / 2) = 1160`)

`payment.webhook.test.ts` (real Polar provider and real signature: `createPolarProvider()`, secret `process.env.POLAR_WEBHOOK_SECRET`, `signPolarWebhook`; body = the Polar JSON of an order: `{ type, timestamp, api_version: "2026-10", data: { id, status, checkout_id, customer_id, metadata: { userId, themeId, couponId: "" }, currency, subtotal_amount, discount_amount, tax_amount, total_amount, refunded_amount, refunded_tax_amount, created_at } }`; request `new Request("http://localhost:3000/api/webhooks/polar", { method: "POST", body, headers })`)
- [ ] handlePaymentWebhook › a correctly signed `order.paid` → 200 `{ received: true }`; 1 order, `provider.name "polar"`, webhook event `processed` with `eventId` = the `webhook-id`
- [ ] handlePaymentWebhook › a wrong signature → 403 `{ error: "Invalid signature" }`; 0 orders, 0 webhook events
- [ ] handlePaymentWebhook › a signed event type we do not handle (`customer.created`) → 200; webhook event `ignored`
- [ ] handlePaymentWebhook › a signed body that is not JSON → 400 `{ error: "Invalid body" }`; 0 webhook events
- [ ] handlePaymentWebhook › a refund before its order → 500 `{ error: "Temporary failure" }`; webhook event `failed`
- [ ] handlePaymentWebhook › a permanent problem (unknown theme id) → 200 `{ received: true }`; webhook event `failed`; 0 orders
- [ ] handlePaymentWebhook › the same signed webhook delivered twice → 200 both times; 1 order, `salesCount 1`
- [ ] handlePaymentWebhook › a signed `order.refunded` with `status "refunded"` after the paid webhook → 200; order `refunded`, ownership revoked

`checkout.service.test.ts` (read the recorded calls on `fakePaymentProvider.calls`)
- [ ] startCardCheckout › refuses a draft theme and an unknown slug → NOT_FOUND `"This theme is not available."`; 0 provider calls
- [ ] startCardCheckout › refuses an already owned theme → CONFLICT `"You already own this theme."`; a revoked ownership is allowed
- [ ] startCardCheckout › refuses an invalid coupon → INVALID `"This coupon code is not valid."`; 0 provider calls
- [ ] startCardCheckout › refuses a theme without a provider product id → INVALID `"Card payment is not available for this theme right now. Please try again later."`; `console.error` was called (spy)
- [ ] startCardCheckout › syncs a coupon that has no discount id first and uses the new id; when the sync fails → the same card-unavailable error and no checkout call
- [ ] startCardCheckout › a provider failure (`failNext`) → the same card-unavailable error
- [ ] startCardCheckout › passes product id, discount id, `userId`, `themeId`, `couponId`, email, name and `successUrl` `"http://localhost:3000/checkout/success?checkout_id={CHECKOUT_ID}"` to the provider; returns the URL of the fake checkout
- [ ] startCardCheckout › without a coupon passes `discountId null` and `couponId null`
- [ ] getCheckoutPageData › ready: the 20 % coupon gives `quote.finalCents 2320` and `finalPriceCents 2320`
- [ ] getCheckoutPageData › an expired coupon gives `couponError "This coupon has expired."`, `quote null`, `finalPriceCents 2900`
- [ ] getCheckoutPageData › `owned` for an owner, `not_found` for a draft theme
- [ ] simulateFakePayment › creates the order through `processPaymentEvent` with `provider.name "fake"`, `provider.orderId "fake_ord_<checkoutId>"`, amounts from the coupon quote, `userId` = the given user; calling it twice leaves 1 order

`order.service.test.ts`
- [ ] listOrdersForUser › returns only the user's orders, newest first
- [ ] listOrdersForUser › 25 orders: page 1 has 20, page 2 has 5, `totalPages 2`; a page above `totalPages` is empty
- [ ] getOrderForCheckout › returns the order for its owner and `null` for another user or an unknown checkout id

`user.service.test.ts` (added): `getUserSummary` returns `{ id, name, email, country }`; `null` for `"not-an-id"` and for an unknown id.
`theme.service.test.ts` (added): `getThemeForPurchase` returns a draft theme with `providerProductId`, `null` for an unknown slug; `adjustSalesCount` adds and subtracts 1 (inside `withTransaction`).

`email.service.test.ts` (added) — `sendOrderConfirmationEmail`
- [ ] sends subject `"Your purchase: <Theme name>"` to the buyer, containing the theme name, the formatted total (`$23.20`), the order id and the absolute link `http://localhost:3000/account/themes`
- [ ] shows the coupon line `Coupon SAVE20: −$5.80` only when there was a discount
- [ ] contains no `/api/downloads/` and no settings link

`checkout.schemas.test.ts` / `order.schemas.test.ts`
- [ ] checkoutSearchParamsSchema › a missing or too long `coupon` becomes `""`; `checkoutSuccessSearchParamsSchema` › `"fake_chk_ab12"` is accepted, `"a b"` and `""` become `undefined`
- [ ] startCardCheckoutSchema › refuses a slug with capital letters; `""` coupon becomes `null`
- [ ] orderListSearchParamsSchema › `page` below 1 or not a number becomes 1 (`{ page: z.coerce.number().int().min(1).catch(1) }`, same as the theme schemas)

## E2E (`e2e/checkout.spec.ts`, flow 2 of `10-testing.md` §8)

`e2e/helpers.ts` (created by T-005, extended by T-006, T-008 and T-009) gets two new functions:
- `markEmailVerified(email)`: `mongoose.connection.db.collection("user").updateOne({ email }, { $set: { emailVerified: true } })` (new users are not verified, and checkout needs a verified user; Better Auth's cookie cache is off, so it takes effect immediately). Needs an open mongoose connection.
- `seedPublishedThemeWithZip({ runId, priceCents })`: creates a category and a **published** theme (`provider: { productId: "fake_prod_" + runId, syncedAt: new Date() }`, slug `e2e-<runId>`, name `E2E Theme <runId>`, `latestVersion` as below) with one real version, exactly like the seed of `e2e/downloads.spec.ts` (T-009): `zipBody = createZipFile("a/style.css", "1.0.0 " + runId)`, key `theme-zips/<themeId>/<randomBytes(8).toString("hex")>.zip`, `await putStoredFile({ bucket: "private", key, contentType: "application/zip", body: zipBody })`, then `VersionModel.create({ themeId, version: "1.0.0", changes: [{ type: "new", text: "First release" }], file: { key, sizeBytes: zipBody.length, sha256: <createHash("sha256").update(zipBody).digest("hex")>, originalName: "theme.zip" }, releasedAt, notifyRequested: false, notificationJobId: null })` and `ThemeModel.updateOne({ _id: themeId }, { $set: { latestVersion: { versionId, version: "1.0.0", releasedAt } } })`. Returns `{ themeId, slug, name, zipBody }`.

`checkout.spec.ts` (`test.describe.configure({ mode: "serial" })`; `beforeAll`: connect mongoose, seed the theme with `priceCents 2900` and a coupon `E2E-<RUN_ID>` (`CouponModel.create`: percent 20, all themes, `provider.discountId "fake_disc_e2e"`); `afterAll`: delete the seeded theme, category, coupon, orders, ownerships; disconnect)
- [ ] a verified customer buys with the coupon: register (`registerAs`), `markEmailVerified`, open `/themes/<slug>`, click `Buy now` → URL `/checkout/<slug>`, text `$29.00`; fill `Coupon code`, click `Apply` → text `Coupon applied.`, `−$5.80` and `$23.20`; click `Continue to payment` → URL contains `/checkout/fake/`; click `Simulate successful payment` → URL contains `/checkout/success?checkout_id=fake_chk_`; heading `Thank you! <name> is yours.`; clicking the link whose name starts with `Download` starts a download named `<slug>-1.0.0.zip` whose bytes equal the seeded zip; DB: 1 order with `totalAmount 2320`, the coupon `redemptionsCount 1`, 1 active ownership
- [ ] an invalid coupon shows its message and keeps the price: fill `NOPE`, click `Apply` → text `This coupon code is not valid.` and `$29.00` (no `$23.20`)
- [ ] an owner who opens the checkout again is sent to `/account/themes` (URL check)
- [ ] `/checkout/fake/anything` without a session redirects to the login page; `/api/webhooks/polar` with a GET answers 405 (route only exports `POST`)

Break check (≥ 3): remove the `already_recorded` check in `recordCardOrder`; remove the `status !== "refunded"` guard in `recordRefund`; make `processPaymentEvent` skip the duplicate check; remove the `orderId` condition in the ownership revoke (T-009 test would fail too — mention it); remove `userId` from the `getOrderForCheckout` filter.

## Do NOT

- Do not grant ownership anywhere except through `processPaymentEvent` / `recordCardOrder` (D-034). The success page only reads.
- Do not use the price or ids sent by the browser for money: the server reads price, coupon and user itself. Do not log webhook bodies.
- Do not call the provider, send emails or read storage inside a transaction.
- Do not add fields or indexes that are not in 03 §7 / §16. No wallet code. No admin order pages.
- Feature components and pages: layout classes only. No `any`, no `@ts-ignore`, no `eslint-disable`.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-012: card checkout, webhook and orders`
