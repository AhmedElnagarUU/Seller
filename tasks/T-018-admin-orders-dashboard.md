# T-018: Admin orders, "Mark as refunded" and the dashboard

- Depends on: T-017 (and so T-005 … T-016, all merged into `main`)
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2.3, 5, 7, 9; `docs/03-data-model.md` sections 7 (orders, status rules), 8, 15, 17, 19 ("Admin marks a wallet order refunded");
  `docs/05-pages.md` section 5 (rows `/admin`, `/admin/orders`, `/admin/orders/[id]`); `docs/06-payments.md` 7.6; `docs/00-product.md` 4.1, 4.4, 3.10;
  `docs/01-decisions.md` D-011, D-014, D-105, D-114, D-124; `docs/10-testing.md` sections 2, 11 (clock).
  Copy the layer pattern of `src/features/categories/` and the admin list pattern of `src/app/admin/themes/page.tsx`.

## Goal

1. **Orders (admin):** a filtered list of all orders (card and wallet) and an order page with every amount and id.
2. **Mark as refunded** for wallet orders (D-105): the customer loses access; the owner returned the money outside the site.
   (Card refunds already arrive through the Polar webhook in T-012 — not touched here.)
3. **Dashboard** (`/admin`, replaces the temporary page of T-004): sales per currency, top themes, "waiting for you", latest activity.
   Revenue is always **per currency, never added together** (D-124).

**Not in this task:** card refunds from the admin panel; partial refunds of wallet orders; refund emails (there is none in 09 §3);
any chart; export; the wallet-payment review pages (T-013).

## Files

```
src/features/orders/
  order.repository.ts            (change) add findOrdersForAdmin, countOrdersForAdmin, findOrderByIdForAdmin, markWalletOrderRefundedIfPaid, sumSales, topThemesBySales
  order.constants.ts             (change) add PROVIDER_LABELS; also ORDER_STATUS_LABELS / ORDER_STATUS_TONES / ORDER_METHOD_LABELS only if T-012 did not already export them (see "Labels")
  order-admin.service.ts         (new) listOrdersForAdmin, getOrderForAdmin, markWalletOrderRefunded
  order-admin.schemas.ts         (new) adminOrderSearchParamsSchema, markRefundedSchema
  order-admin.types.ts           (new)
  order-admin.actions.ts         (new) markWalletOrderRefundedAction
  order-admin.service.test.ts    (new)
  order-admin.schemas.test.ts    (new)
  dashboard.service.ts           (new) getDashboard
  dashboard.constants.ts         (new)
  dashboard.schemas.ts           (new) dashboardSearchParamsSchema
  dashboard.types.ts             (new)
  dashboard.service.test.ts      (new)
  components/admin/OrderFilters.tsx
  components/admin/OrderTable.tsx
  components/admin/OrderDetails.tsx
  components/admin/MarkRefundedButton.tsx      ("use client")
  components/admin/SalesTables.tsx
  components/admin/TopThemesLists.tsx
  components/admin/WaitingForYou.tsx
  components/admin/LatestActivity.tsx

src/features/downloads/download-log.repository.ts   (change) add topThemesByDownloads(since: Date | null, limit: number)
src/features/downloads/download.service.ts          (change) add getTopThemesByDownloads(since: Date | null, limit: number): Promise<{ themeId: string; count: number }[]>
src/features/users/components/admin/CustomerOrdersSection.tsx  (change) add a TextLink "View" → /admin/orders/<id> in each row (T-017 left it out)
src/shared/ui/TextField.tsx                          (change) allow type "date" (05 §5 filters use type="date")

src/app/admin/page.tsx                               (replace the temporary page)
src/app/admin/orders/page.tsx
src/app/admin/orders/[id]/page.tsx
e2e/admin-orders.spec.ts
```

**Functions of earlier tasks used here (names are not repeated in the docs).** **[PLANNER 18-D]** Planner: write the exact names and parameters of each before this task is given to the implementing agent:
- the function T-012's `recordRefund` uses to revoke the matching ownership with `revokedReason: "refund"` **only when the ownership's `orderId` is this order** (03 §7, D-014) — takes `session`;
- the function T-012 uses for `themes.stats.salesCount -= 1` — takes `session`;
- `activityService.log(entry, session?)` (T-005, fields of 03 §15) and the T-005 function behind `/admin/activity` that returns the newest rows (first page = 20 rows, newest first);
- the T-013 function that counts wallet payments with status `submitted` (the one behind the admin menu badge);
- `countNewFeedback()` (T-016); `getUserSummaries(userIds)` (T-016); `listThemeOptionsForAdmin()` (T-017).
If an item does not exist, stop and write a question in `docs/QUESTIONS.md`. Do not rewrite T-012's refund logic: reuse its functions.

## Packages

None.

## Part 1 — Admin orders

### Labels

05 §4 gives the labels of an order status: "Paid" (tone success), "Partly refunded" (warning), "Refunded" (neutral); method: "Card", "Wallet".
T-012 made them for `/account/orders`. Reuse them. If they are not exported constants (for example they are inside a component), add exported
`ORDER_STATUS_LABELS`, `ORDER_STATUS_TONES`, `ORDER_METHOD_LABELS` to `order.constants.ts` with exactly these values and leave T-012's component alone.
Provider labels for the order page: add `PROVIDER_LABELS` to `order.constants.ts` (`polar` → "Polar", `fake` → "Fake provider", `manual_wallet` → "Manual wallet"); the type of its key is the provider-name type of T-012's constants (`polar | fake | manual_wallet`).

### Schemas (`order-admin.schemas.ts`)

`adminOrderSearchParamsSchema` (05 §1.4: a bad value falls back to its default, never an error):
```ts
method: z.enum(ORDER_METHODS).optional().catch(undefined),      // "card" | "wallet"  (constants of T-012)
status: z.enum(ORDER_STATUSES).optional().catch(undefined),     // "paid" | "partially_refunded" | "refunded"
from: dayField, to: dayField,                                    // "YYYY-MM-DD", a real calendar day, else undefined
page: z.coerce.number().int().min(1).catch(1),
```
`dayField` = `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` that also passes `!Number.isNaN(Date.parse(value + "T00:00:00.000Z"))` and round-trips (`"2026-02-31"` is refused), `.optional().catch(undefined)`.
`markRefundedSchema = z.object({ orderId: z.string().trim().regex(/^[a-f0-9]{24}$/i, "Not found.") })`.

### Repository (`order.repository.ts`)

Every function calls `connectDB()` first; writes take `session?: ClientSession`.

| Function | Does |
|---|---|
| `findOrdersForAdmin(filter, page, pageSize)` / `countOrdersForAdmin(filter)` | `filter = { method?, status?, paidFrom?: Date, paidBefore?: Date }`. `method`, `status` exact; `paidAt >= paidFrom` and `paidAt < paidBefore` when given. Sort `{ paidAt: -1, _id: -1 }`. `.lean()`. |
| `findOrderByIdForAdmin(id)` | `null` for an invalid id (`parseObjectId`) or a missing order |
| `markWalletOrderRefundedIfPaid(id, refundedAt, session)` | `findOneAndUpdate({ _id, method: "wallet", status: "paid" }, [{ $set: { status: "refunded", refundedAmount: "$totalAmount", refundedAt } }], { returnDocument: "after", session })` (pipeline update, so `refundedAmount` takes the order's own `totalAmount`). Returns `null` when the order does not match (wrong method, wrong status, or not found). |
| `sumSales(currency, since: Date \| null)` | aggregate `$match { currency, status: { $in: ["paid", "partially_refunded"] }, paidAt: { $gte: since } (only when `since` is not null) }`, `$group { _id: null, orders: { $sum: 1 }, revenueAmount: { $sum: { $subtract: ["$totalAmount", "$refundedAmount"] } } }`; no rows → `{ orders: 0, revenueAmount: 0 }` |
| `topThemesBySales(since: Date \| null, limit)` | same `$match` without `currency`, `$group` by `themeId` with `count`, sort `{ count: -1, _id: 1 }`, `$limit` → `{ themeId: string; count: number }[]` |

### DTOs (`order-admin.types.ts`)

```ts
export type AdminOrderListItemDTO = { id: string; paidAt: Date; customerId: string; customerName: string; customerEmail: string;
  themeName: string; method: OrderMethod; currency: Currency; totalAmount: number; status: OrderStatus };
export type AdminOrderPageDTO = { items: AdminOrderListItemDTO[]; page: number; totalPages: number; total: number };
export type AdminOrderDTO = { id: string; status: OrderStatus; method: OrderMethod; currency: Currency;
  subtotalAmount: number; discountAmount: number; taxAmount: number; totalAmount: number; refundedAmount: number;
  couponCode: string | null; customer: { id: string; name: string; email: string };
  theme: { id: string; name: string; slug: string };          // name and slug are the copies saved on the order (themeSnapshot)
  provider: { name: OrderProviderName; orderId: string; checkoutId: string | null; customerId: string | null };
  walletPaymentId: string | null; paidAt: Date; refundedAt: Date | null;
  canMarkRefunded: boolean };                                  // true only for method "wallet" and status "paid"
```
`customerName` / `customerEmail` come from `getUserSummaries`; a missing user shows `"—"` for both.

### Service (`order-admin.service.ts`)

| Function | Rules / errors |
|---|---|
| `listOrdersForAdmin({ method, status, from, to, page })` | `paidFrom = from at 00:00:00.000 UTC`; `paidBefore = (to at 00:00 UTC) + 1 day` — so a day in `to` is included until its last millisecond (05 §5 "UTC days"); `from` later than `to` gives an empty list, no error. 20 per page (02 §7), newest `paidAt` first. Returns `AdminOrderPageDTO`. |
| `getOrderForAdmin(id): Promise<AdminOrderDTO \| null>` | `null` for unknown or invalid id. `canMarkRefunded = method === "wallet" && status === "paid"`. |
| `markWalletOrderRefunded(orderId, adminUserId)` | 1) order must exist, else `AppError("NOT_FOUND", <[PLANNER 18-E]>)`. 2) **one transaction** (03 §19): `markWalletOrderRefundedIfPaid(...)`; `null` (card order, or not `paid`, e.g. already refunded) → `AppError("INVALID", "This order cannot be marked as refunded.")` (06 §7.6, word for word) and nothing is changed; then revoke the matching ownership with `revokedReason "refund"` **only if its `orderId` is this order** (an ownership of another order or an admin grant stays active); `themes.stats.salesCount -= 1`; log `order_refunded` (`actorRole "admin"`, `actorUserId` = admin, `subjectUserId` = the order's customer, `targetType "order"`, `targetId` = order id, `summary`). Use the T-012 functions of 18-D for the revoke and the counter. The conditional update makes two clicks at once safe: the second one fails the status check. |

**[PLANNER 18-E]** Texts the docs do not give. Recommended: not-found message `"Order not found."`; summary of the log row `"Order refunded: <theme name> (<formatPrice(totalAmount, currency)>)"`
(03 §15's example for paid orders is `"Order paid: Aurora Blog ($29.00)"`; if T-012 put the `order_refunded` summary in a shared text builder, use that builder so card and wallet refunds read the same).

### Action (`order-admin.actions.ts`)

`markWalletOrderRefundedAction(previous: ActionResult | null, formData: FormData): Promise<ActionResult>` (06 §7.6 names it):
`requireAdmin()` → `markRefundedSchema.safeParse({ orderId: readText(formData, "orderId") })` → `markWalletOrderRefunded(parsed.data.orderId, admin.id)` in try/catch (`failureFrom`) →
revalidate `/admin/orders`, `/admin/orders/[id]` (page), `/admin`, `/admin/activity`, `/admin/customers/[id]` (page), `/account/orders`, `/account/themes` → `{ ok: true, data: undefined }`.

## Part 2 — Dashboard

### Constants (`dashboard.constants.ts`)

```ts
export const DASHBOARD_RANGES = ["30d", "all"] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];
export const DEFAULT_DASHBOARD_RANGE: DashboardRange = "30d";
export const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = { "30d": "30 days", all: "All time" };   // 05 §5
export const SALES_PERIODS = ["today", "last7days", "last30days", "allTime"] as const;
export const SALES_PERIOD_LABELS = { today: "Today", last7days: "7 days", last30days: "30 days", allTime: "All time" } as const;   // 05 §5
export const TOP_THEMES_LIMIT = 5;                    // [PLANNER 18-C]
export const LATEST_ACTIVITY_COUNT = 20;              // 05 §5, 00 §4.1
```

**[PLANNER 18-A]** The docs name the periods but not how they are cut. Recommended: **Today** = from 00:00 UTC of `now()`'s day; **7 days** = `paidAt >= now() − 7 × 24 hours`; **30 days** = `paidAt >= now() − 30 × 24 hours`; **All time** = no limit. The boundary is inclusive (`>=`). All times UTC, `now()` from `shared/lib/clock`.

**[PLANNER 18-B]** "Orders" and "Revenue (net of refunds)" need one counting rule. Recommended: an order is counted when its status is `paid` or `partially_refunded` (the same idea as `salesCount`, D-114: fully refunded orders are not sales); revenue = sum of `totalAmount − refundedAmount` of the counted orders, in the minor unit of the currency. Written into `sumSales` above.

**[PLANNER 18-C]** Not in the docs: how many themes a "top themes" list shows (recommended **5**), the default `?range=` (recommended **`30d`**), and what the toggle does. Recommended: one `?range=30d|all` parameter drives **both** lists; each list shows the two toggle links ("30 days", "All time"; the current one as `primary`).
Order: highest count first; equal counts by theme id ascending.

### Schema (`dashboard.schemas.ts`)

`dashboardSearchParamsSchema = z.object({ range: z.enum(DASHBOARD_RANGES).catch(DEFAULT_DASHBOARD_RANGE) })`.

### DTO (`dashboard.types.ts`)

```ts
export type SalesRowDTO = { period: SalesPeriod; orders: number; revenueAmount: number };
export type TopThemeDTO = { themeId: string; themeName: string; count: number };
export type DashboardDTO = {
  sales: { usd: SalesRowDTO[]; egp: SalesRowDTO[] };           // 4 rows each, in the order of SALES_PERIODS
  range: DashboardRange;
  topThemesBySales: TopThemeDTO[];
  topThemesByDownloads: TopThemeDTO[];
  walletPaymentsToReview: number;
  newFeedbackCount: number;
  latestActivity: { id: string; createdAt: Date; summary: string }[];
};
```

### Service (`dashboard.service.ts`)

`getDashboard(range: DashboardRange): Promise<DashboardDTO>` — one function, helpers inside the file (each ≤ 40 lines). It runs these in parallel and nothing else:
- 8 × `sumSales(currency, since)` (`usd` and `egp` × the four periods, `since` as in 18-A);
- `topThemesBySales(since, 5)` and `getTopThemesByDownloads(since, 5)` where `since` is `null` for `"all"` and `now() − 30 days` for `"30d"`; theme names from `listThemeOptionsForAdmin()` matched by id (a theme missing from it is dropped);
- the wallet count of 18-D (`status "submitted"`), `countNewFeedback()`, and the newest 20 activity rows (18-D).
Revenue of the two currencies is **never** added together; the DTO keeps them in separate arrays.

## Pages and components

All pages call `requireAdmin()` and export `metadata` with `robots: { index: false }`. Titles `Dashboard · Theme Store`, `Orders · Theme Store`, `Order · Theme Store`.

**`/admin`** — replaces the temporary page. `requireAdmin()`, `dashboardSearchParamsSchema.parse(await searchParams)`, `getDashboard(range)`. `Stack gap="lg"`:
1. Heading level 1 "Dashboard".
2. `SalesTables`: two `Table`s, each under a Heading level 2: "Sales in USD (card)" and "Sales in EGP (wallet)". Columns Period, Orders, Revenue; rows Today / 7 days / 30 days / All time. Revenue is `formatPrice(revenueAmount, "usd")` / `formatPrice(revenueAmount, "egp")`.
3. `TopThemesLists`: Heading level 2 "Top themes by sales" and "Top themes by downloads", each with the two toggle links (`ButtonLink size="sm"` to `/admin?range=30d` and `/admin?range=all`) and a list of `TextLink` theme name → `/admin/themes/<themeId>` + the count. Empty list: Text `Nothing yet.` (**[PLANNER 18-C]** text recommended).
4. `WaitingForYou` (Heading level 2 "Waiting for you"): `TextLink` `"<n> wallet payments to review"` → `/admin/wallet-payments` and `TextLink` `"<n> new feedback messages"` → `/admin/feedback` (the wording of 05 §5 exactly; no singular form).
5. `LatestActivity` (Heading level 2 "Latest activity"): a `Table` with Date (`formatDate`) and Summary, 20 rows. Empty: Text `No activity yet.` (**[PLANNER 18-C]** text recommended).

**`/admin/orders?method=&status=&from=&to=&page=`** — Heading level 1 "Orders". `OrderFilters`: a GET form to `/admin/orders` (works without JavaScript) with `SelectField` "Method" (placeholder `"All"`; options Card / Wallet), `SelectField` "Status" (placeholder `"All"`; options Paid / Partly refunded / Refunded), `TextField type="date"` "From", `TextField type="date"` "To", `Button type="submit"` "Apply"; defaults from the parsed params.
`OrderTable` columns Date (`formatDate(paidAt)`), Customer (`TextLink` name → `/admin/customers/<customerId>`), Theme, Method (label), Total (`formatPrice(totalAmount, currency)`), Status (`Badge` with the T-012 labels/tones), and `TextLink` "View" → `/admin/orders/<id>`.
`Pagination` keeps all params. Empty: Text `No orders found.` (**[PLANNER 18-C]** text recommended).

**`/admin/orders/[id]`** — `getOrderForAdmin(id)`; `null` → `notFound()`. Heading level 1 `Order <id>`; `Badge` status; `OrderDetails` (a `Card` with one labelled line per value, label in `Text weight="bold"`): Customer (`TextLink` → `/admin/customers/<id>`, plus email), Theme (`TextLink` → `/admin/themes/<themeId>`, the snapshot name), Method, Subtotal, Discount (and `Coupon: <code>` when `couponCode`), Tax, Total, Refunded amount, Paid on, Refunded on (only when set), Payment provider (label), Provider order id, Checkout id and Provider customer id (only when not `null`), and for wallet orders a `TextLink` "View wallet payment" → `/admin/wallet-payments/<walletPaymentId>`. Amounts with `formatPrice(amount, currency)`.
When `canMarkRefunded`: `MarkRefundedButton`.

`MarkRefundedButton` (`"use client"`): `useActionState(markWalletOrderRefundedAction, null)`; `<form action={formAction} onSubmit={…}>` where `onSubmit` calls `window.confirm("The customer loses access to the theme. Did you already send the money back?")` and `event.preventDefault()` when the answer is no (the text is word for word from 05 §5); hidden `orderId`; `FormError`; `SubmitButton variant="danger"` "Mark as refunded" / `"Saving…"`.

## Required tests

`order-admin.service.test.ts` (real in-memory MongoDB; factories `createUser`, `createAdmin`, `createTheme`, `createOrder`, `createOwnership`; clock with `setTestNow`)
- [ ] listOrdersForAdmin › lists orders newest paid first with customer, theme name, method, amount and status → 3 orders with different `paidAt`: order of ids, `customerName`/`customerEmail` of the right user, `themeName` from the snapshot
- [ ] listOrdersForAdmin › filters by method → 1 card + 1 wallet: `method "wallet"` returns only the wallet one
- [ ] listOrdersForAdmin › filters by status → paid, partially refunded and refunded orders: each filter returns exactly its order
- [ ] listOrdersForAdmin › includes the whole `to` day in UTC and excludes the next day → orders paid at `2026-10-31T23:59:59Z`, `2026-11-01T00:00:00Z`, `2026-11-01T23:59:59Z`, `2026-11-02T00:00:00Z`; `from "2026-11-01"`, `to "2026-11-01"` returns exactly the 2nd and 3rd
- [ ] listOrdersForAdmin › returns an empty page when `from` is after `to` → `items []`, `total 0`
- [ ] listOrdersForAdmin › paginates 20 per page → 25 orders: page 1 has 20, page 2 has 5, `totalPages` 2
- [ ] getOrderForAdmin › returns every amount, coupon code, customer, snapshot, provider ids and dates → values equal the stored order; `canMarkRefunded` is `true` for a paid wallet order and `false` for a paid card order and for a refunded wallet order
- [ ] getOrderForAdmin › returns null for an unknown and an invalid id
- [ ] markWalletOrderRefunded › refunds the order, revokes the ownership, lowers salesCount and logs it → order: `status "refunded"`, `refundedAmount = totalAmount`, `refundedAt = now()`; ownership `status "revoked"`, `revokedReason "refund"`; theme `stats.salesCount` from 1 to 0; 1 `order_refunded` row (`actorRole "admin"`, `subjectUserId` = customer, `targetType "order"`, `targetId` = order)
- [ ] markWalletOrderRefunded › leaves an ownership of another order or an admin grant active → the order is refunded and `salesCount` lowered, the ownership (admin grant) stays `"active"`
- [ ] markWalletOrderRefunded › refuses a card order → INVALID `"This order cannot be marked as refunded."`; order still `paid`; ownership active; `salesCount` unchanged; 0 activity rows
- [ ] markWalletOrderRefunded › refuses an order that is already refunded and changes nothing the second time → second call INVALID same message; `salesCount` lowered once
- [ ] markWalletOrderRefunded › refuses an unknown order → NOT_FOUND with the 18-E message

`order-admin.schemas.test.ts`
- [ ] adminOrderSearchParamsSchema › keeps valid values and falls back for bad ones → `method=card&status=refunded&from=2026-11-01&to=2026-11-05&page=2` kept; `method=x`, `status=y`, `from=2026-02-31`, `to=abc`, `page=0` become `undefined` / page 1

`dashboard.service.test.ts` (clock fixed with `setTestNow(new Date("2026-11-10T12:00:00Z"))`; `createDownloadLog` rows made with `DownloadLogModel.create`, and their age changed with the raw call `DownloadLogModel.collection.updateOne({ _id }, { $set: { createdAt } })`)
- [ ] getDashboard › keeps USD (card) and EGP (wallet) separate and never adds them → 1 card order of 2900 and 1 wallet order of 145000: `sales.usd` all-time revenue 2900, `sales.egp` all-time revenue 145000
- [ ] getDashboard › counts partly refunded orders net of the refund and ignores refunded ones → paid 2900, partially refunded 2900 with `refundedAmount` 1000, refunded 2900: orders 2, revenue 2900 + 1900 = 4800
- [ ] getDashboard › cuts the periods as in 18-A → orders paid at `2026-11-10T00:00:00Z` (today), `2026-11-09T23:59:59Z`, `2026-11-03T12:00:00Z` (exactly 7 days), `2026-11-03T11:59:59Z`, `2026-10-11T12:00:00Z` (exactly 30 days), `2026-10-11T11:59:59Z`: order counts per row Today 1, 7 days 3, 30 days 5, All time 6
- [ ] getDashboard › ranks top themes by sales for 30 days and for all time → theme A 3 recent sales, theme B 1 recent and 4 old: `30d` gives A (3), B (1); `all` gives B (5), A (3); refunded orders not counted; at most 5 themes
- [ ] getDashboard › ranks top themes by downloads for 30 days and for all time → same idea with download logs; theme names filled
- [ ] getDashboard › reports what is waiting → 2 wallet payments `submitted` + 1 `approved`, 3 `new` + 1 `read` feedback: `walletPaymentsToReview` 2, `newFeedbackCount` 3
- [ ] getDashboard › returns the newest 20 activity rows → 25 rows: 20 returned, newest first, `summary` filled
- [ ] getDashboard › returns zeros and empty lists on an empty database → every sales row 0 / 0, lists `[]`
- [ ] dashboardSearchParamsSchema › falls back to `30d` for a bad range → `"abc"` and a missing value give `"30d"`; `"all"` is kept

`e2e/admin-orders.spec.ts` (style of `e2e/catalog.spec.ts`: `RUN_ID`, `registerAs`, admin `removeAdminAccount`; seeds with the factories of `@/shared/test/factories`, read their parameters there)
Seed in the test: the customer registers through the UI (`customer-${RUN_ID}@example.com`); then look up their id with `UserModel`; create a published theme named `Wallet Theme ${RUN_ID}`, a wallet payment (`approved`, not open), a **wallet order** (`method "wallet"`, `currency "egp"`, `totalAmount 145000`, `status "paid"`, linked to that wallet payment, `provider { name "manual_wallet", orderId = <wallet payment id> }`) and an **active purchase ownership** of that theme with that order.
- [ ] the admin marks a wallet order as refunded and the customer loses access
      Customer opens `/account/themes` → `Wallet Theme ${RUN_ID}` visible.
      Admin registers as `admin@example.com`, opens `/admin/orders?method=wallet`, in the row containing `Wallet Theme ${RUN_ID}` clicks "View", registers a handler `page.once("dialog", (dialog) => dialog.accept())`, clicks "Mark as refunded" →
      a `Badge` with the text "Refunded" is visible and the button "Mark as refunded" is gone (`toHaveCount(0)`).
      Customer reloads `/account/themes` → `Wallet Theme ${RUN_ID}` is not visible and the text `You do not own any themes yet.` is.
- [ ] the order list filters by method → admin opens `/admin/orders?method=card`: the row of `Wallet Theme ${RUN_ID}` is not visible; `?method=wallet`: it is
      Cleanup in `afterAll`: delete the seeded theme, wallet payment, order and ownership.

Break check (≥ 3): remove the `status: "paid"` condition of `markWalletOrderRefundedIfPaid`; remove the "only if the ownership's `orderId` is this order" condition; add the EGP revenue into the USD row in `getDashboard`; use `<` instead of `<=` for the `to` day (or drop the `+ 1 day`).

## Do NOT

- Do not change T-012's refund code, its tests, or the Polar webhook. Do not add partial refunds, a refund email, or a card refund button.
- Do not mix currencies anywhere (D-124). Do not compute revenue from `themes.stats`.
- Do not add fields, indexes or activity actions. Do not hard-delete orders.
- Do not import another feature's repository or model (D-087): downloads, themes, ownerships, feedback, wallet payments, activity and users are used through their services.
- Feature components and pages: layout classes only (`pnpm check:styles`). `window.confirm` is the confirmation: no new dialog component.
- No `any`, no `@ts-ignore`, no `eslint-disable`. Do not change or delete any existing test; only add the listed ones.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-018: admin orders and dashboard`
