# T-010: Payment provider (Polar + fake), theme sync to Polar, publish / unpublish

- Depends on: T-001 – T-009
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2, 5, 7, 10; `docs/03-data-model.md` section 5 (status rules), section 15, section 19 ("Admin publishes a theme");
  `docs/06-payments.md` sections 1, 2, 3.1, 8, 10; `docs/05-pages.md` section 5 (`/admin/themes/[id]` row);
  `docs/10-testing.md` sections 2 – 4; `docs/01-decisions.md` D-030 – D-033, D-092, D-133.

## Goal

1. The `PaymentProvider` interface, its two implementations (Polar and the fake provider) and the test fake.
2. Every theme is mirrored as a Polar product (create, and update when name, tagline or price change).
3. The admin can publish and unpublish a theme, with the publish checklist and the "Retry sync" button.

**Not in this task** (later tasks): coupons and `upsertDiscount` callers (T-011), checkout, webhook route,
`processPaymentEvent`, orders, `simulateFakeRefund`, the fake checkout page (T-012). `upsertDiscount`,
`createCheckout` and `parseWebhook` ARE implemented now (the interface is one unit) but nothing calls them yet.
Do not add the favorites/notification fan-out code: publishing only **creates** the job (`createThemePublishedJob`, T-007).

## Contract: functions of earlier tasks that this task calls

Use these names. If the merged code spells one differently, use the real name and do **not** rename it.
Ids are passed as strings.

| Name | File | From |
|---|---|---|
| `activityService.log(input, session?)` — `import * as activityService from "@/features/activity/activity.service"`. `input: ActivityLogInput` = `{ action, actorRole, actorUserId?, subjectUserId?, targetType?, targetId?, summary }` (03 §15); omitted nullable fields are saved as `null`; a `system` entry must not have an `actorUserId`; with a `session` every error is thrown (the transaction rolls back); `summary` is 2–300 characters. | `features/activity/activity.service.ts` | T-005 |
| `createThemePublishedJob({ themeId, categoryId, createdByUserId }, session)` | `features/notifications/notification-job.service.ts` | T-007 |
| `NotificationJobModel` (tests read it) | `features/notifications/notification-job.model.ts` | T-007 |
| `ActivityLogModel` (tests read it) | `features/activity/activity-log.model.ts` | T-005 |
| `withTransaction(fn)` | `shared/db/transaction.ts` | T-001 |

## Packages

`@polar-sh/sdk` — **1.0.2** (exact, no `^`). Planner check on 2026-11-06: `npm view @polar-sh/sdk@1 version` lists `1.0.0`, `1.0.1`, `1.0.2`;
`latest` is 1.0.2. Run the command again; if a newer **stable** 1.x exists, add a question to `docs/QUESTIONS.md` instead of choosing.
Nothing else is added (`crypto` is `node:crypto`).

This SDK is **versioned by import path**. Always import from `@polar-sh/sdk/2026-10` (as `06-payments.md` section 3 says), never from `@polar-sh/sdk`.
Field names in requests and responses are `snake_case` (`success_url`, `price_amount`). Facts verified in the SDK's type files:

- `createPolar({ accessToken, environment })` with `environment` `"sandbox"` or `"production"`.
- `client.products.create(body)` / `client.products.update(id, body)` → returns `{ id, ... }`.
- A product's price is changed by sending `prices: [ { amount_type: "fixed", price_currency: "usd", price_amount: <cents> } ]` in the update. A list **without** `ExistingProductPrice` ids replaces the old prices.
- `client.discounts.create(body)` / `client.discounts.update(id, body)` → `{ id, ... }`. Percent = `type: "percentage"` + `basis_points` (1 % = 100). Fixed = `type: "fixed"` + `amount` + `currency`. `duration: "once"`.
- `client.checkouts.create(body)` → `{ id, url, ... }`. Body has `products`, `discount_id`, `allow_discount_codes`, `metadata`, `customer_email`, `customer_name`, `success_url`. `success_url` accepts the `{CHECKOUT_ID}` placeholder.
- `webhooks.validateEvent(rawBody, headers, secret)` (named export `webhooks` of the same path). It throws `webhooks.PolarWebhookVerificationError` (bad or missing signature, old timestamp > 5 min), `webhooks.PolarWebhookUnknownTypeError` (has `.eventType`) and `webhooks.PolarWebhookError` (invalid JSON). The headers argument is a plain object with the keys `webhook-id`, `webhook-timestamp`, `webhook-signature`.

## Env variables added (update `src/shared/config/env.ts`, `.env.example`, `vitest.config.ts` `test.env`, `.github/workflows/ci.yml` `env:`)

| Name | Rule in `env.ts` | `.env.example` | vitest `test.env` | `ci.yml` |
|---|---|---|---|---|
| `PAYMENT_PROVIDER` | `z.enum(["polar", "fake"])`, required | `fake` | `fake` | `fake` |
| `POLAR_SERVER` | `z.enum(["sandbox", "production"])`, default `"sandbox"` | `sandbox` | `sandbox` | — |
| `POLAR_ACCESS_TOKEN` | optional string; **required when `PAYMENT_PROVIDER=polar`** | empty | `polar_oat_test_token` | — |
| `POLAR_WEBHOOK_SECRET` | optional string; **required when `PAYMENT_PROVIDER=polar`** | empty | `whsec_test_secret_for_unit_tests` | — |

`[PLANNER: the docs do not say how strict POLAR_* are. Recommended: required only when PAYMENT_PROVIDER=polar (same pattern as RESEND_API_KEY / EMAIL_TRANSPORT). Confirm or change.]`

Extra rules in the existing `superRefine` of `env.ts` (same style as the console-email rule):

| Condition | Issue path | Message |
|---|---|---|
| `PAYMENT_PROVIDER === "fake"` and `APP_ENV === "production"` | `PAYMENT_PROVIDER` | `PAYMENT_PROVIDER=fake is not allowed when APP_ENV=production` |
| `PAYMENT_PROVIDER === "polar"` and no `POLAR_ACCESS_TOKEN` | `POLAR_ACCESS_TOKEN` | `POLAR_ACCESS_TOKEN is required when PAYMENT_PROVIDER=polar` |
| `PAYMENT_PROVIDER === "polar"` and no `POLAR_WEBHOOK_SECRET` | `POLAR_WEBHOOK_SECRET` | `POLAR_WEBHOOK_SECRET is required when PAYMENT_PROVIDER=polar` |

Put a one-line comment above each new line in `.env.example` (the file has a comment before every variable).
The e2e run uses `PAYMENT_PROVIDER=fake`: a developer's local `.env` must get the new line too (copy it from `.env.example`).

## Files

```
package.json, pnpm-lock.yaml                     add @polar-sh/sdk 1.0.2
.env.example, vitest.config.ts, .github/workflows/ci.yml     (change) env, see above
src/shared/config/env.ts                         (change) 4 variables + 3 rules
src/shared/config/env.test.ts                    new (see Required tests)

src/features/payments/payment.types.ts           exactly the types of 06 §2 + `WebhookPayloadError` (below)
src/features/payments/payment.provider.ts        getPaymentProvider()
src/features/payments/polar/polar.mapper.ts      pure functions: request bodies, webhook mapping
src/features/payments/polar/polar.mapper.test.ts
src/features/payments/polar/polar.provider.ts    createPolarProvider() — the ONLY file (with the mapper) that imports @polar-sh/sdk
src/features/payments/polar/polar.provider.test.ts   only parseWebhook (no network)
src/features/payments/fake/fake.provider.ts      createFakeProvider() (06 §8, without simulateFakeRefund: T-012)
src/features/payments/fake/fake.provider.test.ts
src/features/payments/payment-sync.service.ts    syncThemeProduct()
src/features/payments/payment-sync.service.test.ts

src/shared/test/fakes/fake-payment-provider.ts   FakePaymentProvider + the shared instance `fakePaymentProvider`
src/shared/test/webhook-signing.ts               signPolarWebhook(): headers for a signed test webhook (used here and in T-012)
src/shared/test/setup.ts                         (change) mock getPaymentProvider with the fake; reset it beforeEach

src/features/themes/theme.repository.ts          (change) setThemeProvider, markThemePublished, markThemeUnpublished
src/features/themes/theme-sync.service.ts        syncThemeWithProvider(), retryThemeSync()
src/features/themes/theme-sync.service.test.ts
src/features/themes/theme-publish.service.ts     publishTheme(), unpublishTheme(), getPublishChecklist()
src/features/themes/theme-publish.service.test.ts
src/features/themes/theme-publish.actions.ts     publishThemeAction, unpublishThemeAction, syncThemeAction
src/features/themes/theme.service.ts             (change) createTheme / updateTheme call syncThemeWithProvider
src/features/themes/theme.service.test.ts        (change) ONE existing assertion + new tests, see "Existing tests that change"
src/features/themes/theme.types.ts               (change) PublishChecklistDTO
src/features/themes/components/admin/PublishChecklist.tsx
src/features/themes/components/admin/PublishPanel.tsx   ("use client")
src/app/admin/themes/[id]/page.tsx               (change) add the checklist block (below)

e2e/publish.spec.ts
```

## `payment.types.ts`

Copy the types of `06-payments.md` section 2 exactly (`ProviderName`, `NormalizedOrder`, `PaymentEvent`, `PaymentProvider`, `WebhookSignatureError`), and add:

```ts
// Thrown by parseWebhook when the signature is fine but the body is not a usable event (HTTP 400).
export class WebhookPayloadError extends Error {}
```

`[PLANNER: 06 §6.1 says "Body not valid → 400" but defines no error class for it. Recommended: this class. Confirm.]`

## `payment.provider.ts`

```ts
let provider: PaymentProvider | null = null;
// Polar or fake, chosen by env.PAYMENT_PROVIDER. Created on first use.
export function getPaymentProvider(): PaymentProvider
```
`"fake"` → `createFakeProvider()`; otherwise `createPolarProvider()`. Cached in the module variable.

## Polar mapper (`polar/polar.mapper.ts`) — pure, no SDK calls

Import the SDK **types only** (`import type { models } from "@polar-sh/sdk/2026-10"`).

```ts
export type PolarOrderFields = Pick<models.Order,
  "id" | "checkout_id" | "customer_id" | "metadata" | "currency" | "subtotal_amount" | "discount_amount" |
  "tax_amount" | "total_amount" | "created_at" | "status" | "refunded_amount" | "refunded_tax_amount">;
```

| Function | Returns |
|---|---|
| `buildProductCreateBody(input)` — input = the `upsertProduct` input | `{ name: input.name, description: input.tagline, metadata: { themeId: input.themeId }, prices: [fixedUsdPrice(input.priceCents)], recurring_interval: null }` |
| `buildProductUpdateBody(input)` | `{ name, description: tagline, metadata: { themeId }, prices: [fixedUsdPrice(priceCents)] }` |
| `fixedUsdPrice(cents)` (also exported) | `{ amount_type: "fixed", price_currency: "usd", price_amount: cents }` |
| `buildDiscountCreateBody(input)` — input = the `upsertDiscount` input | percent: `{ name: code, type: "percentage", basis_points: percentOff * 100, duration: "once", metadata: { couponId } }`; fixed: `{ name: code, type: "fixed", amount: amountOffCents, currency: "usd", duration: "once", metadata: { couponId } }`. When `productIds` is not `null`, add `products: productIds`; when `null`, do **not** add the key. No `code` key (customers cannot type codes on Polar). No expiry, no `max_redemptions` (06 §3.2). |
| `buildDiscountUpdateBody(input)` | `{ name: code }` plus `products: productIds` when not `null`. |
| `buildCheckoutBody(input)` — input = the `createCheckout` input | `{ products: [productId], discount_id: discountId, allow_discount_codes: false, metadata: { userId, themeId, couponId: couponId ?? "" }, customer_email: customerEmail, customer_name: customerName, success_url: successUrl }` |
| `mapOrderPaid(order, eventId, type)` | `{ kind: "order_paid", eventId, type, order: NormalizedOrder }` — `providerOrderId = order.id`, `checkoutId = order.checkout_id`, `providerCustomerId = order.customer_id`, `userId = readMetadataText(order.metadata, "userId")`, `themeId = readMetadataText(…, "themeId")`, `couponId = readMetadataText(…, "couponId") === "" ? null : that text`, `currency = order.currency.toLowerCase()`, the four amounts from `subtotal_amount`, `discount_amount`, `tax_amount`, `total_amount`, `paidAt = new Date(order.created_at)` |
| `mapOrderRefunded(order, eventId, type)` | `{ kind: "order_refunded", eventId, type, providerOrderId: order.id, refundedAmount: order.refunded_amount + order.refunded_tax_amount, isFullRefund: order.status === "refunded" }` |
| `readMetadataText(metadata, key)` | the value when it is a `string`, otherwise `""` (a missing key, a number or a boolean all give `""`) |
| `assertUsableOrder(order)` | throws `WebhookPayloadError("The order in the webhook is not usable.")` when `id` is not a non-empty string, when any of the 6 amount fields (`subtotal_amount`, `discount_amount`, `tax_amount`, `total_amount`, `refunded_amount`, `refunded_tax_amount`) is not an integer, or when `created_at` is not a valid date. Called by both map functions first. |

Missing `userId` / `themeId` metadata is **not** an error here: the mapper gives `""` and `processPaymentEvent` (T-012) decides (permanent error).

## Polar provider (`polar/polar.provider.ts`)

```ts
// The Polar implementation of PaymentProvider. Only this folder knows Polar's field names (D-032).
export function createPolarProvider(): PaymentProvider
```
- Read `env.POLAR_ACCESS_TOKEN` and `env.POLAR_WEBHOOK_SECRET`. If either is missing, `throw new Error("Polar is not configured.")`.
- One client: `createPolar({ accessToken, environment: env.POLAR_SERVER })`, created inside `createPolarProvider` (not at module load).
- `name: "polar"`.
- `upsertProduct`: with `existingProductId` → `client.products.update(id, buildProductUpdateBody(input))`, else `client.products.create(buildProductCreateBody(input))`. Return `{ productId: product.id }`.
- `upsertDiscount`: with `existingDiscountId` → `client.discounts.update(id, buildDiscountUpdateBody(input))`, else `client.discounts.create(buildDiscountCreateBody(input))`. Return `{ discountId: discount.id }`.
- `createCheckout`: `client.checkouts.create(buildCheckoutBody(input))`. Return `{ checkoutId: checkout.id, url: checkout.url }`.
- `parseWebhook(rawBody, headers)`:
  1. `eventId = headers.get("webhook-id") ?? ""`.
  2. `payload = await webhooks.validateEvent(rawBody, Object.fromEntries(headers.entries()), webhookSecret)`.
  3. `payload.type === "order.paid"` → `mapOrderPaid(payload.data, eventId, payload.type)`; `"order.refunded"` → `mapOrderRefunded(...)`; any other type → `{ kind: "ignored", eventId, type: payload.type }`.
  4. Error translation (a `try/catch` around steps 2–3): `webhooks.PolarWebhookVerificationError` → `throw new WebhookSignatureError("Invalid signature")`; `webhooks.PolarWebhookUnknownTypeError` → return `{ kind: "ignored", eventId, type: error.eventType ?? "unknown" }`; any other `webhooks.PolarWebhookError` → `throw new WebhookPayloadError("The webhook body is not valid.")`; a `WebhookPayloadError` from the mapper passes through; anything else is rethrown.
  5. An event `type` longer than 100 characters is cut to 100 (`webhookEvents.type` max, 03 §16).
- Never log the body or the secret.

## Fake provider (`fake/fake.provider.ts`)

```ts
// The provider used when PAYMENT_PROVIDER=fake: local development and E2E. No network (06 §8).
export function createFakeProvider(): PaymentProvider
```
`name: "fake"`. `upsertProduct` → `{ productId: "fake_prod_" + themeId }`. `upsertDiscount` → `{ discountId: "fake_disc_" + couponId }`.
`createCheckout` → `checkoutId = "fake_chk_" + randomBytes(8).toString("hex")` (`node:crypto`) and
`url = env.APP_URL + "/checkout/fake/" + checkoutId + "?theme=" + themeId + "&coupon=" + (couponId ?? "")`.
`parseWebhook` → `throw new Error("The fake provider has no webhooks.")`.

## Test fakes

`src/shared/test/fakes/fake-payment-provider.ts` (same style as `fake-email-sender.ts`):

```ts
export type RecordedPaymentCall = { method: "upsertProduct" | "upsertDiscount" | "createCheckout" | "parseWebhook"; input: unknown };
export class FakePaymentProvider implements PaymentProvider {
  name: ProviderName = "fake";
  calls: RecordedPaymentCall[] = [];
  // upsertProduct, upsertDiscount, createCheckout, parseWebhook:
  //   1. push { method, input } to `calls` (for parseWebhook the input is { rawBody, headers: Object.fromEntries(headers.entries()) })
  //   2. if a failure is queued, throw it (once)
  //   3. otherwise return what createFakeProvider() returns for the same input
  failNext(error: Error): void;
  reset(): void;           // calls = [], no queued failure
}
export const fakePaymentProvider = new FakePaymentProvider();
```
Delegate to one private `createFakeProvider()` instance (do not copy its logic).

`src/shared/test/setup.ts`: add `vi.mock("@/features/payments/payment.provider", () => ({ getPaymentProvider: () => fakePaymentProvider }));`
and `fakePaymentProvider.reset();` inside the existing `beforeEach`.

`src/shared/test/webhook-signing.ts`:

```ts
// Headers of a webhook signed like Polar does it (Standard Webhooks, HMAC-SHA256). Test use only.
export function signPolarWebhook(input: { id: string; body: string; secret: string; timestampSeconds?: number }): Record<string, string>
```
- `timestampSeconds` defaults to `Math.floor(Date.now() / 1000)` (the SDK checks the real clock, not our `now()`).
- `signature = createHmac("sha256", input.secret).digest("base64")` over the string `` `${id}.${timestamp}.${body}` `` (the key is the **UTF-8 bytes of the whole secret string**, including `whsec_`).
- Returns `{ "webhook-id": id, "webhook-timestamp": String(timestamp), "webhook-signature": "v1," + signature }`.

## Theme sync (`theme-sync.service.ts`) — 06 §3.1

Calls the provider **after** the theme's own DB write, never inside a transaction.

| Function | Rules |
|---|---|
| `syncThemeWithProvider(themeId): Promise<boolean>` | Load the theme (`themeRepository.findThemeById`); missing → return `false`. Call `paymentSyncService.syncThemeProduct({ themeId, name, tagline, priceCents, existingProductId: theme.provider.productId ?? null })`. On `{ ok: true }`: `themeRepository.setThemeProvider(themeId, { productId, syncedAt: now() })`, return `true`. On `{ ok: false }`: return `false` and write nothing. Never throws for a provider failure. |
| `retryThemeSync(themeId): Promise<void>` | Theme missing → `AppError("NOT_FOUND", "Theme not found.")`. `syncThemeWithProvider` returned `false` → `AppError("INVALID", <message below>)`. |

`payment-sync.service.ts`:

```ts
export type ThemeSyncInput = { themeId: string; name: string; tagline: string; priceCents: number; existingProductId: string | null };
export type ThemeSyncResult = { ok: true; productId: string } | { ok: false };
// Sends the theme to the payment provider. A failure is logged and returned, never thrown.
export async function syncThemeProduct(input: ThemeSyncInput): Promise<ThemeSyncResult>
```
Calls `getPaymentProvider().upsertProduct(input)`; in the `catch`: `console.error("syncThemeProduct failed", error)` and return `{ ok: false }`.
(`upsertDiscount` sync is added by T-011 in this same file.)

`theme.service.ts` changes:
- `createTheme`: after `insertTheme` succeeds, `await syncThemeWithProvider(id)` (result ignored), then return `{ id }`.
- `updateTheme`: before the update read the old theme (it is already read for the D-017 check). After `updateThemeById` succeeds: if `name`, `tagline` or `priceCents` differs from the old values, `await syncThemeWithProvider(id)`. Otherwise do **not** call the provider.

`theme.repository.ts` additions (each starts with `await connectDB()`; the writes take an optional `session`):

| Function | Does |
|---|---|
| `setThemeProvider(id, { productId, syncedAt })` | `$set` `provider.productId` and `provider.syncedAt` only |
| `markThemePublished(id, firstPublishedAt, session)` | `updateOne` with filter `{ _id, status: { $in: ["draft", "unpublished"] } }`; `$set` `status: "published"` and, only when `firstPublishedAt` is not `null`, `publishedAt: firstPublishedAt`. Returns `true` when `modifiedCount === 1` |
| `markThemeUnpublished(id, session)` | filter `{ _id, status: "published" }`, `$set` `status: "unpublished"`. Returns `true` when `modifiedCount === 1` |

## Publish and unpublish (`theme-publish.service.ts`) — 03 §5 status rules, §19

Messages (`THEME_PUBLISH_MESSAGES` in `theme.constants.ts`):

| Key | Text |
|---|---|
| `notFound` | `Theme not found.` (docs) |
| `alreadyPublished` | `This theme is already published.` |
| `notPublished` | `Only a published theme can be unpublished.` |
| `noVersion` | `Upload at least one version before publishing.` |
| `noImage` | `Add at least one image before publishing.` |
| `notSynced` | `Sync the theme with the payment provider before publishing.` |
| `syncFailed` | `The sync did not work. Please try again in a moment.` |
| `published` (action message) | `Theme published.` |
| `unpublished` (action message) | `Theme unpublished.` |
| `synced` (action message) | `Theme synced.` |

`[PLANNER: 03 §5 defines the publish rules but no error messages, and no action messages. All texts in this table except notFound are proposals. Confirm or change.]`

| Function | Rules |
|---|---|
| `publishTheme(themeId, adminUserId): Promise<void>` | 1. Theme missing → NOT_FOUND `notFound`. 2. `status === "published"` → CONFLICT `alreadyPublished`. 3. Checks, in this order, each INVALID: `latestVersion` null → `noVersion`; `images.length === 0` → `noImage`; `provider.productId` null → `notSynced`. 4. `isFirstPublish = theme.publishedAt` is `null`/`undefined`. 5. **Transaction** (`withTransaction`): `markThemePublished(themeId, isFirstPublish ? now() : null, session)`; when it returns `false` → CONFLICT `alreadyPublished`; when `isFirstPublish`: `createThemePublishedJob({ themeId, categoryId: theme.categoryId.toString(), createdByUserId: adminUserId }, session)`; `activityService.log({ action: "theme_published", actorRole: "admin", actorUserId: adminUserId, subjectUserId: null, targetType: "theme", targetId: themeId, summary: "Theme published: <Theme name>" }, session)`. |
| `unpublishTheme(themeId, adminUserId): Promise<void>` | 1. Missing → NOT_FOUND. 2. `status !== "published"` → CONFLICT `notPublished`. 3. Transaction: `markThemeUnpublished(themeId, session)` (`false` → CONFLICT `notPublished`); `activityService.log({ action: "theme_unpublished", … summary: "Theme unpublished: <Theme name>" }, session)`. No job. |
| `getPublishChecklist(themeId): Promise<PublishChecklistDTO \| null>` | `null` when the theme is missing. `hasVersion = latestVersion !== null`, `hasImage = images.length > 0`, `isSynced = provider.productId !== null`, `canPublish = hasVersion && hasImage && isSynced && status !== "published"`. |

`PublishChecklistDTO = { status: ThemeStatus; hasVersion: boolean; hasImage: boolean; isSynced: boolean; canPublish: boolean }` in `theme.types.ts`.

`[PLANNER: activity summaries are not in the docs except the example "Order paid: Aurora Blog ($29.00)". The pattern "<Event>: <Theme name>" above is a proposal; confirm for T-010 … T-013.]`

## Actions (`theme-publish.actions.ts`)

All three: `(_previous: ActionResult | null, formData: FormData): Promise<ActionResult>`, same pattern as `deleteCategoryAction`:
`const user = await requireAdmin();` → `try { service call } catch (error) { return failureFrom(error, "<actionName>", {}) }` → `revalidateThemePages()` → `return { ok: true, data: undefined, message }`.
The theme id comes from the hidden field `id` (`readText(formData, "id")`).

| Action | Service | Message |
|---|---|---|
| `publishThemeAction` | `publishTheme(id, user.id)` | `Theme published.` |
| `unpublishThemeAction` | `unpublishTheme(id, user.id)` | `Theme unpublished.` |
| `syncThemeAction` | `retryThemeSync(id)` | `Theme synced.` |

`revalidateThemePages()` (local function): `revalidatePath` for `/`, `/themes`, `/admin/themes`, `/admin/themes/[id]` (type `"page"`), `/themes/[slug]` (`"page"`), `/categories/[slug]` (`"page"`).

## Page change: `/admin/themes/[id]`

In `src/app/admin/themes/[id]/page.tsx` add **only** this: call `getPublishChecklist(theme.id)` and render `<PublishPanel>` directly under the header `Inline` (above the `ThemeForm`). Leave everything else as it is (T-006 / T-008 add more to this page).

- `PublishChecklist.tsx` (server component, props `{ checklist: PublishChecklistDTO }`): a `Card` with Heading level 3 `Publish checklist` and three rows, each an `Inline` with `Badge` (`tone="success"` and text `✓`, or `tone="danger"` and text `✗`) and a `Text`: `At least one version`, `At least one image`, `Synced to Polar`. When `isSynced` is `false`, a `Text tone="danger"` below the rows: `Not synced with payment provider`.
- `PublishPanel.tsx` (`"use client"`, props `{ themeId: string; checklist: PublishChecklistDTO }`): renders `PublishChecklist`, then
  - when `!isSynced`: a form (`useActionState(syncThemeAction, null)`) with hidden `id` and `SubmitButton variant="secondary"` text `Retry sync` / pending `Syncing…`;
  - when `status === "published"`: a form with `unpublishThemeAction` and `SubmitButton variant="danger"` `Unpublish` / `Unpublishing…`;
  - otherwise: a form with `publishThemeAction`; when `canPublish` is `false` render `<Button disabled>Publish</Button>` instead of the submit button; when true `SubmitButton` `Publish` / `Publishing…`;
  - each form shows `FormError` (`state?.ok === false ? state.error : null`) and, on success, `Alert tone="success"` with `state.message`.
  `[PLANNER: 05 §5 calls the button "Sync now", 06 §3.1 calls it "Retry sync". Recommended: "Retry sync" (06). Confirm.]`

## Existing tests that change (behaviour changed on purpose)

In `theme.service.test.ts`, test `createTheme › saves a draft with price in cents`: replace
`expect(saved?.provider).toEqual({ productId: null, syncedAt: null });` with
`expect(saved?.provider.productId).toBe("fake_prod_" + id);` and `expect(saved?.provider.syncedAt).toEqual(<the fixed now>)`
(call `setTestNow(new Date("2026-11-01T10:00:00Z"))` at the start of that test). Nothing else in existing tests changes.

## Required tests

`src/shared/config/env.test.ts` (use `vi.resetModules()`, `vi.stubEnv(...)`, `await import("@/shared/config/env")`, `vi.unstubAllEnvs()` in `afterEach`; set `EMAIL_TRANSPORT=resend` and `RESEND_API_KEY=key` in the cases that set `APP_ENV=production`, so only the payment rule fails)
- [ ] env › refuses PAYMENT_PROVIDER=fake when APP_ENV=production → import rejects with a message containing `PAYMENT_PROVIDER`
- [ ] env › accepts PAYMENT_PROVIDER=fake when APP_ENV=ci
- [ ] env › requires POLAR_ACCESS_TOKEN and POLAR_WEBHOOK_SECRET when PAYMENT_PROVIDER=polar → message names both
- [ ] env › accepts PAYMENT_PROVIDER=polar with both Polar variables

`polar.mapper.test.ts`
- [ ] buildProductCreateBody › one fixed USD price in cents, tagline as description, `{ themeId }` metadata, `recurring_interval: null` → `toEqual` the whole body (priceCents 2900 → `price_amount: 2900`)
- [ ] buildProductUpdateBody › replaces the price list with the new price → `prices` equals `[{ amount_type: "fixed", price_currency: "usd", price_amount: 4900 }]`
- [ ] buildDiscountCreateBody › percent 20 → `type: "percentage"`, `basis_points: 2000`, `duration: "once"`, no `code`, no `products` key for productIds `null`
- [ ] buildDiscountCreateBody › fixed 1000 → `type: "fixed"`, `amount: 1000`, `currency: "usd"`; `products` equals the given ids when not null
- [ ] buildCheckoutBody › passes metadata `userId`, `themeId`, `couponId`; `couponId: null` becomes `""`; `allow_discount_codes: false`; `discount_id` null when no discount; `success_url` unchanged (contains `{CHECKOUT_ID}`)
- [ ] mapOrderPaid › maps ids, lower-cased currency, the four amounts, `paidAt` as a Date, and an empty coupon id to `null`
- [ ] mapOrderPaid › gives `""` for missing metadata and for non-text metadata values
- [ ] mapOrderPaid › refuses a non-integer amount and an invalid `created_at` → `WebhookPayloadError`
- [ ] mapOrderRefunded › `refundedAmount` = `refunded_amount + refunded_tax_amount` (e.g. 1000 + 160 → 1160); `isFullRefund` is `true` only for status `"refunded"`

`polar.provider.test.ts` (provider created with `createPolarProvider()`; secret = `process.env.POLAR_WEBHOOK_SECRET`; `signPolarWebhook` for headers; no network is used by `parseWebhook`)
- [ ] parseWebhook › a signed `order.paid` body gives an `order_paid` event whose `eventId` is the `webhook-id` header and whose order amounts match
- [ ] parseWebhook › a signed `order.refunded` body gives `order_refunded` with the summed refunded amount
- [ ] parseWebhook › a wrong signature throws `WebhookSignatureError`
- [ ] parseWebhook › missing signature headers throw `WebhookSignatureError`
- [ ] parseWebhook › a signed event of another type (`"customer.created"`) gives `{ kind: "ignored", type: "customer.created" }`
- [ ] parseWebhook › a signed body that is not JSON throws `WebhookPayloadError`

`fake.provider.test.ts`
- [ ] createFakeProvider › `upsertProduct` returns `fake_prod_<themeId>` and `upsertDiscount` returns `fake_disc_<couponId>`
- [ ] createFakeProvider › `createCheckout` returns an id starting with `fake_chk_` and the URL `http://localhost:3000/checkout/fake/<id>?theme=<themeId>&coupon=<couponId>`; with no coupon the URL ends with `&coupon=`
- [ ] createFakeProvider › `parseWebhook` throws

`payment-sync.service.test.ts`
- [ ] syncThemeProduct › sends theme id, name, tagline, price and existing product id to the provider and returns `{ ok: true, productId }` → checked on `fakePaymentProvider.calls`
- [ ] syncThemeProduct › returns `{ ok: false }` and does not throw when the provider fails (`failNext`); `console.error` was called (spy, restore after)

`theme-sync.service.test.ts` (`setTestNow` fixed)
- [ ] syncThemeWithProvider › saves `provider.productId` and `provider.syncedAt = now()` → DB row
- [ ] syncThemeWithProvider › sends the saved product id as `existingProductId` on the second call
- [ ] syncThemeWithProvider › returns `false` and leaves `provider` as `{ productId: null, syncedAt: null }` when the provider fails
- [ ] retryThemeSync › saves the product id after an earlier failure
- [ ] retryThemeSync › refuses with INVALID `"The sync did not work. Please try again in a moment."` when the provider fails; unknown id → NOT_FOUND `"Theme not found."`

`theme.service.test.ts` (new `it`s in new `describe` blocks; use `fakePaymentProvider`)
- [ ] createTheme › syncs the new theme: provider call has `existingProductId: null`; DB has `fake_prod_<id>`
- [ ] createTheme › keeps the theme when the sync fails → 1 theme in DB, `provider.productId` null
- [ ] updateTheme › syncs with the existing product id when the price changed
- [ ] updateTheme › does not call the provider when only the description or `featured` changed → `calls` is empty

`theme-publish.service.test.ts` (build the themes with `createTheme({ status: "draft", latestVersion: {...}, images: [...], provider: { productId: "fake_prod_x", syncedAt: <date> } })` from the factory)
- [ ] publishTheme › refuses a theme without a version → INVALID `"Upload at least one version before publishing."`; status still `draft`; 0 jobs; 0 activity logs
- [ ] publishTheme › refuses a theme without an image → INVALID `"Add at least one image before publishing."`
- [ ] publishTheme › refuses a theme that was never synced → INVALID `"Sync the theme with the payment provider before publishing."`
- [ ] publishTheme › refuses an already published theme → CONFLICT `"This theme is already published."`; unknown id → NOT_FOUND `"Theme not found."`
- [ ] publishTheme › first publish sets status, `publishedAt = now()`, creates one `theme_published` job for the theme's category (`stage: "category_followers"`, status `pending`) and one `theme_published` activity log (actorRole `admin`, actorUserId = admin, targetId = theme, summary `"Theme published: <name>"`)
- [ ] publishTheme › publishing again after unpublish keeps the old `publishedAt` and creates no second job
- [ ] publishTheme › rolls back everything when the log insert fails (create the theme with the factory, then `ThemeModel.collection.updateOne({ _id }, { $set: { name: "x".repeat(400) } })`, which bypasses validation, so the summary is longer than the 300 characters of `activityLogs.summary`) → status still `draft`, 0 jobs, 0 logs
- [ ] unpublishTheme › sets `unpublished`, logs `theme_unpublished`; refuses a draft and an already unpublished theme → CONFLICT `"Only a published theme can be unpublished."`
- [ ] getPublishChecklist › reports the three checks and `canPublish`; `null` for an unknown id

## E2E (`e2e/publish.spec.ts`)

Helpers from `e2e/helpers.ts` (created by T-005): `ADMIN_EMAIL`, `readMongoUri`, `registerAs(page, email)`, `removeAdminAccount()`. `playwright.config.ts` already runs one worker (T-005), so specs can share the admin account.
Seed in `beforeAll` (same style as `catalog.spec.ts`): `mongoose.connect(readMongoUri())`, `removeAdminAccount()`, create a category and a **draft** theme with `ThemeModel.create` that has one image, a `latestVersion` (`{ versionId: new mongoose.Types.ObjectId(), version: "1.0.0", releasedAt: new Date() }`) and `provider: { productId: null, syncedAt: null }`.
- [ ] the admin registers, opens `/admin/themes/<id>`, sees `Not synced with payment provider` and a disabled `Publish` button
- [ ] the admin clicks `Retry sync` → the text `Not synced with payment provider` disappears; `Publish` is enabled
- [ ] the admin clicks `Publish` → `Theme published.` appears and `/themes?q=<theme name>` shows the theme card

Break check (≥ 3): remove the `productId` check in `publishTheme`; call the provider on every `updateTheme` (remove the changed-fields condition); remove the `isFirstPublish` condition around `createThemePublishedJob`; remove the `status` filter in `markThemePublished`.

## Do NOT

- Do not import `@polar-sh/sdk` anywhere except `features/payments/polar/` (02 §2.3, D-032).
- Do not call the provider inside a transaction.
- Do not add coupon, checkout, order, webhook-route or `processPaymentEvent` code.
- Do not log webhook bodies, tokens or secrets.
- Do not add fields to models (the theme already has `provider.productId` / `provider.syncedAt`).
- Feature components: layout classes only (`pnpm check:styles`). No `any`, no `@ts-ignore`, no `eslint-disable`.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-010: payment provider, Polar sync, publish and unpublish`
