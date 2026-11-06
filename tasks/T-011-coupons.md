# T-011: Coupons — model, price check (`quote`), admin pages, Polar discount sync

- Depends on: T-001 – T-010
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2, 5, 7; `docs/03-data-model.md` sections 1, 9, 15 (`coupon_created`);
  `docs/06-payments.md` sections 3.2, 4, 11 ("Coupon quote"); `docs/05-pages.md` section 5 (coupons rows);
  `docs/10-testing.md`; `docs/01-decisions.md` D-009, D-018, D-103. Pattern to copy: `src/features/categories/*` and `src/features/themes/*` (T-004).

## Goal

1. The `coupons` collection and the admin screens to create and edit coupons.
2. `couponService.quote(...)`: the one price check used by card checkout (T-012) and wallet checkout (T-013).
3. Sending a new coupon to Polar as a discount (`upsertDiscount`), and retrying that later.

**Not in this task**: using a coupon in a checkout, orders, and counting redemptions in an order (T-012 / T-013 call
`recordRedemption`, which this task creates). A coupon is never deleted (03 §9): there is no delete.

## Contract: functions of earlier tasks that this task calls

| Name | File | From |
|---|---|---|
| `activityService.log(input, session?)` (input shape: see T-010; here `subjectUserId` and `actorUserId` as given below) | `features/activity/activity.service.ts` | T-005 |
| `getPaymentProvider()`, `syncThemeProduct` pattern, `fakePaymentProvider` | `features/payments/…`, `shared/test/fakes/fake-payment-provider.ts` | T-010 |
| `setTestNow`, `now()` | `shared/lib/clock.ts` | T-001 |

## Packages / env

None.

## Files

```
src/shared/db/duplicate-key.ts                 isDuplicateKeyError(error): boolean  (third place that needs it → rule of three)
src/shared/db/duplicate-key.test.ts
src/features/categories/category.repository.ts (change) delete the local isDuplicateKeyError + its constant; import the shared one where it is used
src/features/categories/category.service.ts    (change) use the shared helper instead of categoryRepository.isDuplicateKeyError (message and behaviour unchanged)
src/features/themes/theme.repository.ts        (change) same removal; plus the two functions below
src/features/themes/theme.service.ts           (change) use the shared helper; plus the two functions below
src/shared/ui/TextField.tsx                    (change) add "date" to the allowed `type` values (nothing else)

src/features/coupons/
  coupon.model.ts / coupon.repository.ts / coupon.service.ts / coupon.mapper.ts / coupon.schemas.ts
  coupon.types.ts / coupon.constants.ts / coupon.actions.ts
  coupon.service.test.ts / coupon.schemas.test.ts / coupon.mapper.test.ts
  components/admin/CouponForm.tsx, components/admin/CouponTable.tsx
src/features/payments/payment-sync.service.ts  (change) add syncCouponDiscount
src/features/payments/payment-sync.service.test.ts (change) add 2 tests
src/shared/test/factories.ts                   (change) createCoupon(overrides?)
src/app/admin/coupons/page.tsx, new/page.tsx, [id]/page.tsx
e2e/coupons.spec.ts
```

## Duplicate-key helper

`src/shared/db/duplicate-key.ts`:

```ts
const MONGO_DUPLICATE_KEY_CODE = 11000;
// True when MongoDB refused a write because of a unique index.
export function isDuplicateKeyError(error: unknown): boolean
```
Same body as the two copies in the category and theme repositories. Replace both copies and their two call sites
(`throwSlugConflict` in `theme.service.ts`, the slug check in `category.service.ts`). Tests of categories and themes stay as they are and must still pass.
`duplicate-key.test.ts`: `isDuplicateKeyError({ code: 11000 })` is `true`; `{ code: 11001 }`, `new Error("x")`, `null` and `"x"` are `false`.

## Model (`coupon.model.ts`) — exactly 03 §9

All fields and both indexes of 03 §9 (`{ code: 1 }` unique, `{ active: 1, createdAt: -1 }`), sub-document `provider` with `{ _id: false }`
(`discountId` string default `null`, `syncedAt` Date default `null`). Collection `coupons`. `themeIds` is `[ObjectId → Theme]`.
Enums in `coupon.constants.ts`: `COUPON_TYPES = ["percent", "fixed"]`, `COUPON_APPLIES_TO = ["all", "selected"]`.
Limits as constants used by Mongoose **and** zod (03 §1.11):

```ts
export const COUPON_CODE_PATTERN = /^[A-Z0-9-]{3,32}$/;
export const PERCENT_OFF_MIN = 1;            export const PERCENT_OFF_MAX = 100;
export const AMOUNT_OFF_MIN_CENTS = 100;     export const AMOUNT_OFF_MAX_CENTS = 100_000;
export const MAX_COUPON_THEMES = 100;
export const MIN_FINAL_PRICE_CENTS = 100;    // 06 §4 check 6
```
Mongoose validators: `percentOff` and `amountOffCents` integers in range (nullable), `maxRedemptions` integer ≥ 1 (nullable), `redemptionsCount` integer ≥ 0 default 0,
`themeIds` at most 100 items. `code` has `match: COUPON_CODE_PATTERN`; the service/schema uppercase it first.
`CouponRecord` via `InferSchemaType` (`& { _id: Types.ObjectId }`), `CouponModel` export, same template as `theme.model.ts`.

## Messages (`COUPON_MESSAGES` in `coupon.constants.ts`)

Quote errors — **exact text from 06 §4**:

| Key | Text |
|---|---|
| `notValid` | `This coupon code is not valid.` |
| `expired` | `This coupon has expired.` |
| `limitReached` | `This coupon has reached its usage limit.` |
| `wrongTheme` | `This coupon cannot be used for this theme.` |

Admin form and service messages (not in the docs): `[PLANNER: confirm every text in this table]`

| Key | Text | Used for |
|---|---|---|
| `codeFormat` | `Use 3 to 32 letters, numbers and dashes.` | zod `code` |
| `typeChoice` | `Choose a discount type.` | zod `type` |
| `percentRange` | `Enter a whole number from 1 to 100.` | zod `value` when type is percent |
| `amountRange` | `Enter an amount between $1.00 and $1,000.00.` | zod `value` when type is fixed |
| `appliesToChoice` | `Choose which themes the coupon works for.` | zod `appliesTo` |
| `themesRequired` | `Choose at least one theme.` | zod `themeIds`: selected with 0 themes |
| `themesTooMany` | `Choose up to 100 themes.` | zod `themeIds`: more than 100 |
| `dateInvalid` | `Enter a valid date.` | zod `expiresAt` |
| `limitInvalid` | `Enter a whole number of 1 or more.` | zod `maxRedemptions` |
| `codeUsed` | `This coupon code is already used.` | CONFLICT on the unique `code` (also for a different letter case) |
| `themesNotSynced` | `Choose themes that are synced with the payment provider.` | INVALID: a selected theme is unknown or has no `provider.productId` |
| `notFound` | `Coupon not found.` | NOT_FOUND |
| `saved` | `Saved.` | update result message |

`[PLANNER: a coupon limited to a theme that is not yet synced to Polar would get a Polar discount that cannot be used for that theme, and D-018 forbids changing the themes later. Recommended: the coupon form only lists, and the service only accepts, themes that already have provider.productId (message themesNotSynced). Alternative: accept any theme and send Polar only the synced ones. Confirm.]`

## Schemas (`coupon.schemas.ts`)

Form values arrive as text. Follow the style of `theme.schemas.ts` (messages above, one per field).

`couponInputSchema` (create):

| Field (form name) | Input | Output (parsed) | Rule |
|---|---|---|---|
| `code` | text | string | trim, uppercase, must match `COUPON_CODE_PATTERN` |
| `type` | `"percent"` or `"fixed"` | same | enum |
| `value` | text | `percentOff: number \| null` and `amountOffCents: number \| null` | type percent: whole number 1–100 → `percentOff`, `amountOffCents = null`. Type fixed: number with at most 2 decimals, 1–1000 → `amountOffCents = Math.round(value * 100)`, `percentOff = null` |
| `appliesTo` | `"all"` or `"selected"` | same | enum |
| `themeIds` | string[] | string[] | `"selected"`: 1–100 unique ids; `"all"`: forced to `[]` (anything sent is ignored) |
| `expiresAt` | text | `Date \| null` | `""` → `null`; otherwise `YYYY-MM-DD` that is a real date → `new Date(value + "T23:59:59.999Z")` (valid through the end of that UTC day). `[PLANNER: the docs say "Expires at (optional date)" only. Recommended: end of that day, UTC. Confirm.]` |
| `maxRedemptions` | text | `number \| null` | `""` → `null`; otherwise whole number ≥ 1 |

`CouponInput = z.output<typeof couponInputSchema>` has exactly: `code, type, percentOff, amountOffCents, appliesTo, themeIds, expiresAt, maxRedemptions`.

`couponUpdateSchema` (edit, D-018: only these three): `active` boolean, `expiresAt` (same rule), `maxRedemptions` (same rule). `CouponUpdateInput`.

## Repository (`coupon.repository.ts`)

Calls `connectDB()` first. Writes take an optional `session`.

| Function | Does |
|---|---|
| `insertCoupon(fields)` | insert; returns the record |
| `findCouponById(id)` | `parseObjectId` first (invalid → `null`), `.lean()` |
| `findCouponByCode(code)` | exact match on the stored (uppercase) code |
| `listCoupons()` | all coupons, newest first (`createdAt` desc, `_id` desc) |
| `updateCouponEditableFields(id, { active, expiresAt, maxRedemptions })` | `$set` those three only; returns the record or `null` |
| `setCouponProvider(id, { discountId, syncedAt })` | `$set` `provider.discountId`, `provider.syncedAt` |
| `incrementRedemptions(id, session)` | `$inc` `redemptionsCount` by 1 |

## Theme service additions (for the coupon form and the sync)

In `theme.service.ts` (with matching functions in `theme.repository.ts`: `findThemesByIds(ids)` — invalid ids are dropped — and `findThemesWithProduct()`):

```ts
// Themes that exist among `themeIds`, with their name and Polar product id (null when not synced).
export async function getThemesProviderInfo(themeIds: string[]): Promise<{ id: string; name: string; productId: string | null }[]>
// Themes that can be used in a coupon: any status, provider.productId is not null. Sorted by name.
export async function listThemesForCouponChoice(): Promise<{ id: string; name: string }[]>
```

## Payment sync (`payment-sync.service.ts`)

```ts
export type CouponSyncInput = {
  couponId: string; code: string; type: "percent" | "fixed"; percentOff: number | null; amountOffCents: number | null;
  productIds: string[] | null; existingDiscountId: string | null;
};
export type CouponSyncResult = { ok: true; discountId: string } | { ok: false };
// Sends the coupon to the payment provider as a discount. A failure is logged and returned, never thrown.
export async function syncCouponDiscount(input: CouponSyncInput): Promise<CouponSyncResult>
```
Same shape as `syncThemeProduct`: `getPaymentProvider().upsertDiscount(input)`; `catch` → `console.error("syncCouponDiscount failed", error)` and `{ ok: false }`.

## Coupon service (`coupon.service.ts`)

| Function | Rules |
|---|---|
| `createCoupon(input, adminUserId): Promise<{ id: string }>` | 1. `appliesTo === "selected"`: `getThemesProviderInfo(input.themeIds)` must return every id and every `productId` not `null`, else INVALID `themesNotSynced`. 2. `insertCoupon` (`redemptionsCount 0`, `active true`, `provider` nulls); duplicate key → CONFLICT `codeUsed`. 3. `activityService.log({ action: "coupon_created", actorRole: "admin", actorUserId: adminUserId, subjectUserId: null, targetType: "coupon", targetId: id, summary: "Coupon created: <CODE>" })` (no transaction, no session). 4. Sync (`syncCouponNow`, below). 5. Return `{ id }`. The coupon stays saved when the sync fails. |
| `updateCoupon(id, input): Promise<void>` | Unknown or invalid id → NOT_FOUND `notFound`. Writes only `active`, `expiresAt`, `maxRedemptions`. Lowering `maxRedemptions` below `redemptionsCount` is allowed (no rule in the docs). |
| `quote({ themeId, priceCents, code }): Promise<CouponQuote>` | The 6 checks of 06 §4, **in this order**, the first failure throws `AppError("INVALID", message)`: (1) `findCouponByCode(code.trim().toUpperCase())` exists → else `notValid`; (2) `active` → else `notValid`; (3) `expiresAt` is `null` or `> now()` (a coupon that expires exactly now is expired) → else `expired`; (4) `maxRedemptions` is `null` or `redemptionsCount < maxRedemptions` → else `limitReached`; (5) `appliesTo === "all"` or `themeIds` contains `themeId` → else `wrongTheme`; (6) `priceCents - discountCents >= MIN_FINAL_PRICE_CENTS` → else `wrongTheme`. Discount: percent `Math.round(priceCents * percentOff / 100)`; fixed `amountOffCents`. Returns `{ couponId, code, discountCents, finalCents }` (`CouponQuote`, in `coupon.types.ts`). Writes nothing. |
| `ensureDiscountId(couponId): Promise<string \| null>` | For card checkout (06 §5.3 step 5). Coupon missing → `null`. `provider.discountId` already set → return it (no provider call). Otherwise `syncCouponNow`; return the new id or `null` when the sync failed. |
| `recordRedemption(couponId, session): Promise<void>` | `incrementRedemptions`. Used inside the order transactions of T-012 / T-013. |
| `getCouponSummary(couponId): Promise<{ id: string; code: string } \| null>` | `null` for an invalid or unknown id. Used by T-012 / T-013. |
| `getCouponForAdmin(id): Promise<CouponAdminDTO \| null>` | `null` for an invalid or unknown id. `themeNames` from `getThemesProviderInfo`. |
| `listCouponsForAdmin(): Promise<CouponListItemDTO[]>` | newest first, no pagination (the docs give this page no `?page=`). |

`syncCouponNow(coupon)` (private helper in the same file, used by `createCoupon` and `ensureDiscountId`): `productIds` = `null` for `"all"`; for `"selected"` the non-null `productId`s of `getThemesProviderInfo(coupon.themeIds)`; when that list is empty return `false`. Call `syncCouponDiscount({ couponId, code, type, percentOff, amountOffCents, productIds, existingDiscountId: coupon.provider.discountId ?? null })`; on `{ ok: true }` call `setCouponProvider(id, { discountId, syncedAt: now() })` and return `true`; otherwise `false`.

## Mapper and DTOs (`coupon.mapper.ts`, `coupon.types.ts`)

```ts
type CouponListItemDTO = { id: string; code: string; discountLabel: string; themesLabel: string; redemptionsCount: number; maxRedemptions: number | null; expiresAt: Date | null; active: boolean };
type CouponAdminDTO = { id: string; code: string; type: CouponType; percentOff: number | null; amountOffCents: number | null; appliesTo: CouponAppliesTo;
  themeIds: string[]; themeNames: string[]; expiresAt: Date | null; maxRedemptions: number | null; redemptionsCount: number; active: boolean; isSynced: boolean };
```
`discountLabel`: percent → `"20%"`; fixed → `formatPrice(amountOffCents, "usd")` → `"$5.00"`. `themesLabel`: `"All themes"`, or `"1 theme"` / `"<n> themes"`.
`isSynced = provider.discountId !== null`.

## Actions (`coupon.actions.ts`)

Pattern of `category.actions.ts` / `theme.actions.ts`: `requireAdmin()` → zod → service in try/catch → revalidate → result/redirect.
- Read the form with `readText` for `code`, `type`, `value`, `appliesTo`, `expiresAt`, `maxRedemptions`, with `formData.getAll("themeIds")` filtered to strings for `themeIds`, and `readCheckbox` for `active`. Send the typed text back as `values` on errors (`themeIds` is not echoed; `active` as `"on"` / `""`).
- `createCouponAction` → on success `redirect("/admin/coupons")`.
- `updateCouponAction` → hidden field `id`; success `{ ok: true, data: undefined, message: "Saved." }`.
- Revalidate `/admin/coupons` and `/admin/coupons/[id]` (`"page"`).

## Pages and components

All pages: `export const metadata = { title: "<Page title> · Theme Store", robots: { index: false } }`, `await requireAdmin()` first (same as the other admin pages).

| URL | Content |
|---|---|
| `/admin/coupons` | `Inline` with Heading 1 `Coupons` and `ButtonLink` `New coupon` → `/admin/coupons/new`. `CouponTable`. Empty list: `Text` `No coupons yet.` |
| `/admin/coupons/new` | Heading `New coupon`, `CouponForm` (create). The theme checkboxes come from `listThemesForCouponChoice()`. |
| `/admin/coupons/[id]` | Heading = the code, `Badge` `Active` (success) / `Inactive` (neutral). `getCouponForAdmin(id)`, unknown → `notFound()`. `CouponForm` (edit). |

`CouponTable` columns (shared `Table`): `Code`, `Discount`, `Themes`, `Used / limit` (`"3 / 10"`, `"3 / Unlimited"`), `Expires` (`formatDate`, or `Never`), `Status` (`Badge` `Active` / `Inactive`), and a `TextLink` `Edit` → `/admin/coupons/<id>`.

`CouponForm` (`"use client"`, `useActionState`, same structure as `ThemeForm`):
- **Create**: `TextField` `Code` (hint `Letters, numbers and dashes. Saved in capital letters.`), `SelectField` `Type` (`Percent`, `Fixed amount`), `TextField` `Value` (hint `Percent: a whole number from 1 to 100. Fixed amount: dollars, for example 5.00.`), `SelectField` `Applies to` (`All themes`, `Selected themes`), a `Text weight="bold"` `Themes` and one `CheckboxField name="themeIds" value=<theme id>` per theme (label = theme name), `TextField type="date"` `Expires at` (hint `Optional.`), `TextField type="number"` `Usage limit` (hint `Optional. Leave empty for no limit.`), `SubmitButton` `Create coupon` / `Creating…`.
- **Edit**: the code, discount (`discountLabel`), themes (`themeNames` joined by `, `, or `All themes`) and `Used` count as read-only `Text` (D-018). Editable: `CheckboxField` `Active`, `Expires at` (default = the saved date as `YYYY-MM-DD`), `Usage limit`. `SubmitButton` `Save changes` / `Saving…`. When `isSynced` is `false`: `Text tone="muted"` `Not synced with the payment provider yet. It is tried again at the first card checkout.`
- Field errors under each field, form error with `FormError`, success with `Alert tone="success"` (same as `ThemeForm`).

`[PLANNER: labels, hints and the empty-list text above are not in the docs (05 §5 only lists the fields). Confirm.]`

## Test factory

`createCoupon` factory (`shared/test/factories.ts`): `createCoupon(overrides?: Partial<Omit<CouponRecord, "_id">>)` — defaults: `code: "COUPON-" + n` (n from the factory counter), `type: "percent"`, `percentOff: 20`, `amountOffCents: null`, `appliesTo: "all"`, `themeIds: []`, `expiresAt: null`, `maxRedemptions: null`, `redemptionsCount: 0`, `active: true`, `provider: { discountId: null, syncedAt: null }`.

## Required tests

`coupon.service.test.ts` (fixed time with `setTestNow(new Date("2026-11-01T10:00:00Z"))`)

quote
- [ ] quote › unknown code → INVALID `"This coupon code is not valid."`
- [ ] quote › inactive coupon → INVALID `"This coupon code is not valid."`
- [ ] quote › expired coupon → INVALID `"This coupon has expired."`; a coupon expiring exactly now is expired too
- [ ] quote › used up (`maxRedemptions 5`, `redemptionsCount 5`) → INVALID `"This coupon has reached its usage limit."`; `redemptionsCount 4` is accepted
- [ ] quote › coupon for other themes → INVALID `"This coupon cannot be used for this theme."`; a coupon for the right theme is accepted
- [ ] quote › price after discount below 100 cents (price 900, fixed 1000) → INVALID `"This coupon cannot be used for this theme."`; price 1100 with fixed 1000 (final exactly 100) is accepted
- [ ] quote › checks run in order: an expired **and** inactive coupon → `"This coupon code is not valid."`; an expired and used-up coupon → `"This coupon has expired."`; a used-up coupon for the wrong theme → `"This coupon has reached its usage limit."`
- [ ] quote › percent: price 2900, 20 % → `discountCents 580`, `finalCents 2320`; rounding: price 1999, 15 % → `discountCents 300` (299.85 rounded), `finalCents 1699`
- [ ] quote › fixed: price 2900, fixed 1000 → `discountCents 1000`, `finalCents 1900`
- [ ] quote › finds the code with spaces and lower case (`" save20 "`) and returns the stored code `SAVE20`
- [ ] quote › writes nothing: `redemptionsCount` is still 0 after a quote

createCoupon
- [ ] createCoupon › saves an all-themes percent coupon: DB row has the uppercased code, `redemptionsCount 0`, `active true`, `themeIds []`; one `coupon_created` log with summary `"Coupon created: SAVE20"` (actorRole `admin`, targetType `coupon`)
- [ ] createCoupon › sends the coupon to the provider and stores the id: `calls` has one `upsertDiscount` with `productIds: null`, `existingDiscountId: null`; DB `provider.discountId` is `fake_disc_<id>`, `syncedAt` is now
- [ ] createCoupon › for selected themes sends their product ids to the provider
- [ ] createCoupon › keeps the coupon when the provider fails (`failNext`): 1 coupon, `provider.discountId` null
- [ ] createCoupon › refuses a used code, also in another letter case → CONFLICT `"This coupon code is already used."`; 1 coupon, 1 log
- [ ] createCoupon › refuses a selected theme without a Polar product id, and an unknown theme id → INVALID `"Choose themes that are synced with the payment provider."`; 0 coupons

updateCoupon / helpers
- [ ] updateCoupon › changes `active`, `expiresAt` and `maxRedemptions` and nothing else (code, type, `percentOff`, `themeIds`, `redemptionsCount` unchanged)
- [ ] updateCoupon › unknown id → NOT_FOUND `"Coupon not found."`
- [ ] ensureDiscountId › returns the saved id without calling the provider
- [ ] ensureDiscountId › syncs a coupon that has no id, saves it and returns it; returns `null` and saves nothing when the provider fails
- [ ] recordRedemption › adds 1 to `redemptionsCount` (call it inside `withTransaction`)
- [ ] getCouponSummary › returns `{ id, code }`; `null` for an unknown or invalid id

`coupon.schemas.test.ts`
- [ ] couponInputSchema › uppercases and trims the code; refuses `"ab"` and `"save 20"` with `"Use 3 to 32 letters, numbers and dashes."`
- [ ] couponInputSchema › percent: `"20"` → `percentOff 20`, `amountOffCents null`; refuses `"0"`, `"101"`, `"12.5"`
- [ ] couponInputSchema › fixed: `"5.00"` → `amountOffCents 500`, `percentOff null`; refuses `"0.5"`, `"1000.01"`, `"12.345"`
- [ ] couponInputSchema › `"selected"` needs 1 theme; `"all"` forces `themeIds` to `[]`
- [ ] couponInputSchema › empty `expiresAt` and `maxRedemptions` become `null`; `"2026-12-31"` becomes `2026-12-31T23:59:59.999Z`; `"2026-02-31"` is refused
- [ ] couponUpdateSchema › parses the three editable fields only

`coupon.mapper.test.ts`
- [ ] toCouponListItemDTO › `"20%"` for percent, `"$5.00"` for fixed, `"All themes"`, `"1 theme"`, `"3 themes"`

`payment-sync.service.test.ts` (added)
- [ ] syncCouponDiscount › passes every field to the provider and returns `{ ok: true, discountId }`
- [ ] syncCouponDiscount › returns `{ ok: false }` and does not throw when the provider fails

## E2E (`e2e/coupons.spec.ts`; helpers from `e2e/helpers.ts`, T-005: `ADMIN_EMAIL`, `readMongoUri`, `registerAs`, `removeAdminAccount`)

- [ ] the admin creates a 20 % coupon for all themes (code `E2E-<RUN_ID>`) → the list shows the code, `20%`, `All themes`, `0 / Unlimited` and `Active`
- [ ] the admin tries to create the same code again → the page shows `This coupon code is already used.`
- [ ] the admin opens `Edit`, unticks `Active`, saves → `Saved.` is shown and the list shows `Inactive`

Break check (≥ 3): swap checks 3 and 2 in `quote`; replace `Math.round` by `Math.floor`; remove the `>= 100` final-price check; allow `updateCoupon` to write `code`.

## Do NOT

- Do not add a delete action (coupons are never deleted) and do not allow editing code, type, value, themes (D-018).
- Do not call the provider inside a transaction. Do not send an expiry or a redemption limit to Polar (06 §3.2).
- Do not count a redemption in `quote` (the order does that, T-012 / T-013).
- Do not add fields or indexes that are not in 03 §9.
- Feature components: layout classes only. No `any`, no `@ts-ignore`, no `eslint-disable`.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-011: coupons`
