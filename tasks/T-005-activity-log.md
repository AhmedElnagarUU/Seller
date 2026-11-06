# T-005: Activity log — model, `activityService.log`, `/admin/activity`

- Depends on: T-004
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2–7, 9; `docs/03-data-model.md` sections 1 and 15;
  `docs/01-decisions.md` D-123; `docs/00-product.md` section 4.8; `docs/05-pages.md` sections 1 and 5 (`/admin/activity` row);
  `docs/10-testing.md`. Copy the structure of `src/features/categories` and `src/features/themes` (T-004).

## Goal

Create the one place that writes the activity log (`activityService.log`) and the admin page that reads it.
Later tasks only **call** `activityService.log` where `03 §19` says; they never touch the model.

**Not in this task:**
- No call of `activityService.log` in any existing feature (each later task adds its own call).
- No "Latest activity" block on the admin dashboard and no "Recent activity" on the customer page (later tasks).
- No deleting or editing of rows: the log is append-only. The database removes rows after 1 year (TTL index).

## Files

```
src/features/activity/
  activity-log.model.ts          03 §15 (collection "activityLogs"); export ActivityLogModel, type ActivityLogRecord
  activity-log.repository.ts     insertActivityLog, findActivityLogs, countActivityLogs
  activity.service.ts            log, listActivity
  activity.mapper.ts             toActivityLogDTO
  activity.schemas.ts            activitySearchParamsSchema
  activity.types.ts              ActivityLogInput, ActivityLogDTO, ActivityPageDTO
  activity.constants.ts          enums, labels, limits (below)
  activity.service.test.ts / activity.schemas.test.ts / activity.mapper.test.ts
  components/admin/ActivityFilters.tsx    GET form
  components/admin/ActivityTable.tsx

src/features/users/user.repository.ts    (change) add findUserByEmail(email), findUsersByIds(ids)
src/features/users/user.service.ts       (change) add getUserIdByEmail(email), getUserNames(userIds)
src/features/users/user.service.test.ts  (change) append the 2 tests listed below; do not touch the existing tests
src/shared/lib/dates.ts                  (change) add formatDateTime (see "Date and time")
src/shared/lib/dates.test.ts             (change) append the formatDateTime test below
src/features/auth/auth.ts                (change) add the databaseHooks.user.create.after hook (see "Logging registrations")
src/features/auth/auth.service.test.ts   (change) append the registration log test below
src/shared/test/factories.ts             (change) add createActivityLog(overrides?)
src/app/admin/activity/page.tsx
playwright.config.ts                     (change) add `workers: 1` inside defineConfig. All e2e files share the one admin
                                         account (admin@example.com), so two e2e files must never run at the same time.
e2e/helpers.ts                           shared e2e helpers (below)
e2e/activity.spec.ts
```

## Packages

None.

## Model (`activity-log.model.ts`)

Exactly 03 §15: fields in the same order, every field has a comment.
- `action`: enum `ACTIVITY_ACTIONS`. `actorRole`: enum `ACTIVITY_ACTOR_ROLES`.
- `actorUserId`, `subjectUserId`: ObjectId, `ref: "User"`, default `null`.
- `targetType`: enum `ACTIVITY_TARGET_TYPES`, default `null`. `targetId`: ObjectId, default `null`.
- `summary`: string, required, trimmed, `minlength 2`, `maxlength 300` (constants).
- Options: `{ collection: "activityLogs", timestamps: true }`.
- Indexes (03 §15), in this order:
  1. `{ createdAt: 1 }` with `expireAfterSeconds: ACTIVITY_RETENTION_SECONDS`
  2. `{ subjectUserId: 1, createdAt: -1 }`
  3. `{ action: 1, createdAt: -1 }`

Types: `ActivityLogRecord` with `InferSchemaType` (D-090).

## Constants (`activity.constants.ts`)

```ts
export const ACTIVITY_ACTIONS = [
  "user_registered", "order_paid", "order_refunded", "wallet_payment_submitted", "wallet_payment_approved",
  "wallet_payment_rejected", "feedback_sent", "theme_published", "theme_unpublished", "version_released",
  "coupon_created", "account_disabled", "account_enabled", "ownership_granted", "ownership_revoked",
  "announcement_sent",
] as const;                                                  // exactly the 16 values of 03 §15, same order
export const ACTIVITY_ACTOR_ROLES = ["customer", "admin", "system"] as const;
export const ACTIVITY_TARGET_TYPES = ["theme", "order", "wallet_payment", "feedback", "coupon", "user", "notification_job"] as const;
export const ACTIVITY_SUMMARY_MIN = 2;
export const ACTIVITY_SUMMARY_MAX = 300;
export const ACTIVITY_RETENTION_SECONDS = 31_536_000;       // 1 year (D-123)
export const ACTIVITIES_PER_PAGE = 20;
export const SYSTEM_ACTOR_LABEL = "System";
export const ADMIN_ACTOR_LABEL = "Admin";
export const UNKNOWN_CUSTOMER_ACTOR_LABEL = "Unknown customer";
```

Also export the types (`ActivityAction`, `ActivityActorRole`, `ActivityTargetType`) as in 03 §1.7, and:

- `ACTIVITY_ACTION_LABELS: Record<ActivityAction, string>`. The labels are the words of 00 §4.8 with a capital first letter:
  `user_registered` "Customer registered", `order_paid` "Order paid", `order_refunded` "Order refunded",
  `wallet_payment_submitted` "Wallet payment submitted", `wallet_payment_approved` "Wallet payment approved",
  `wallet_payment_rejected` "Wallet payment rejected", `feedback_sent` "Feedback sent", `theme_published` "Theme published",
  `theme_unpublished` "Theme unpublished", `version_released` "Version released", `coupon_created` "Coupon created",
  `account_disabled` "Account disabled", `account_enabled` "Account enabled", `ownership_granted` "Theme granted",
  `ownership_revoked` "Theme revoked", `announcement_sent` "Announcement sent".
- `ACTIVITY_TARGET_PATHS: Record<ActivityTargetType, string | null>`: the admin page of each target type
  (05 §5): `theme` `"/admin/themes"`, `order` `"/admin/orders"`, `wallet_payment` `"/admin/wallet-payments"`,
  `feedback` `"/admin/feedback"`, `coupon` `"/admin/coupons"`, `user` `"/admin/customers"`,
  `notification_job` `null` (it has no detail page).

## Input type (`activity.types.ts`)

```ts
export type ActivityLogInput = {
  action: ActivityAction;
  actorRole: ActivityActorRole;
  actorUserId?: string | null;
  subjectUserId?: string | null;
  targetType?: ActivityTargetType | null;
  targetId?: string | null;
  summary: string;
};
```

DTOs: `ActivityLogDTO = { id: string; createdAt: Date; actorLabel: string; summary: string; targetPath: string | null }`,
`ActivityPageDTO = { items: ActivityLogDTO[]; page: number; totalPages: number; total: number }`.

## Service (`activity.service.ts`)

Callers import it as `import * as activityService from "@/features/activity/activity.service"` and call
`activityService.log(...)`. This is why the function is named `log`.

| Function | Rules / errors |
|---|---|
| `log(input: ActivityLogInput, session?: ClientSession): Promise<void>` | Writes **one** row. Omitted nullable fields are saved as `null`. `createdAt` is set to `now()` (clock rule, `10 §2.11`). Ids are converted with `toObjectId`. **System entries never have a user:** `actorRole "system"` together with an `actorUserId` throws `new Error("A system activity entry cannot have an actor user.")` before anything is written. **With a `session`** (inside a transaction): every error is thrown, so the transaction rolls back. **Without a `session`**: it never throws. Any error is caught and written with `console.error("activity log failed", input.action, error)` (never the summary), and the function returns normally. |
| `listActivity({ action, customerEmail, page }): Promise<ActivityPageDTO>` | Newest first (`createdAt` desc, then `_id` desc), `ACTIVITIES_PER_PAGE` per page, `page` at least 1. Filter `action` (optional). Filter `customerEmail` (optional): the email is trimmed and lowercased, the users service `getUserIdByEmail` finds the customer, and rows match when `subjectUserId` is that customer. When `customerEmail` is not empty but no customer has this email, the result is an empty list (`items []`, `total 0`, `totalPages 0`). Both filters together are combined with AND. A page above `totalPages` returns empty `items` (05 §1.5). `totalPages = ceil(total / 20)`. `actorLabel`: `actorRole "system"` → `SYSTEM_ACTOR_LABEL`; `"admin"` → `ADMIN_ACTOR_LABEL`; `"customer"` → the customer's name from the users service `getUserNames` (one call for all rows of the page), or `UNKNOWN_CUSTOMER_ACTOR_LABEL` when that user no longer exists. |

Users feature (the activity feature must not import the user repository or model, D-087):
- `user.repository.ts`: `findUserByEmail(email)` (exact match on the already lowercased email, `.lean()`, or `null`) and
  `findUsersByIds(ids: string[])` (invalid ids are ignored, returns only `_id` and `name`).
- `user.service.ts`: `getUserIdByEmail(email): Promise<string | null>` (trims and lowercases) and
  `getUserNames(userIds: string[]): Promise<Map<string, string>>` (user id → name; unknown ids are missing from the map).

## Mapper (`activity.mapper.ts`)

`toActivityLogDTO(record: ActivityLogRecord, actorLabel: string): ActivityLogDTO`:
`id` string, `createdAt`, `actorLabel`, `summary`, and
`targetPath` = `ACTIVITY_TARGET_PATHS[targetType]` + `"/" + targetId` when both `targetType` and `targetId` are set and the
path for that type is not `null`; otherwise `null`. Example: `{ targetType: "theme", targetId: <id> }` → `/admin/themes/<id>`.

## Schema (`activity.schemas.ts`)

`activitySearchParamsSchema` (query of `/admin/activity`, 05 §1.4: a bad value falls back, never an error page):
`action: z.enum(ACTIVITY_ACTIONS).optional().catch(undefined)`, `customer: z.string().trim().catch("")`,
`page: z.coerce.number().int().min(1).catch(1)`. Copy the style of `adminThemeSearchParamsSchema`.

## Page `/admin/activity?action=&customer=&page=`

`requireAdmin()`, then `activitySearchParamsSchema.parse(await searchParams)`, then
`listActivity({ action, customerEmail: customer, page })`. Metadata title `"Activity · Theme Store"`, `robots: { index: false }`.
Copy `src/app/admin/themes/page.tsx` for the structure and a `buildHref(action, customer, page)` that keeps both filters.

- `Heading level 1` "Activity".
- `ActivityFilters` (plain GET form, `action="/admin/activity"`, copy `ThemeFilters`): `SelectField` label "Action"
  (options from `ACTIVITY_ACTION_LABELS` in the order of `ACTIVITY_ACTIONS`, placeholder "All actions", `name="action"`),
  `TextField` label "Customer email" (`name="customer"`, `type="email"`), `Button type="submit"` "Apply".
- `ActivityTable`: `Table` with header cells "Date and time", "Actor", "Summary", "Target".
  Cells: the date and time of `createdAt` (see below), `actorLabel`, `summary`, and `TextLink` "Open" to `targetPath`
  (or "—" when `targetPath` is `null`).
- `Pagination` below the table, keeping the filters.
- Empty list: `Text` "No activity found."

### Date and time

Add `formatDateTime(date: Date): string` to `src/shared/lib/dates.ts`: UTC, locale `en-US`, 24-hour clock, format `"Oct 27, 2026, 14:05"` (use an `Intl.DateTimeFormat` with `year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC"`; check that midnight gives `"00:05"`, not `"24:05"`). The table shows `createdAt` with it.

### Logging registrations

In `src/features/auth/auth.ts`, inside the existing `databaseHooks`, add (it covers email and Google sign-ups):

```ts
user: {
  create: {
    after: async (user) =>
      activityService.log({
        action: "user_registered", actorRole: "customer", actorUserId: user.id, subjectUserId: user.id,
        targetType: "user", targetId: user.id, summary: `Customer registered: ${user.name}`,
      }),
  },
},
```
Import `import * as activityService from "@/features/activity/activity.service"`. Keep the existing `session.create.before` hook as it is. A log failure must not break sign-up: `log` without a session already swallows errors (03 §15). If the summary would be longer than 300 characters the log is skipped by that same rule (names are at most 80 characters).

## Factory (`createActivityLog`)

`createActivityLog(overrides?)` in `factories.ts`, same style as `createCategory`. Defaults: `action "order_paid"`,
`actorRole "system"`, `actorUserId null`, `subjectUserId null`, `targetType null`, `targetId null`,
`summary "Order paid: Theme <number>"`. `createdAt` can be passed in `overrides` (Mongoose keeps a given `createdAt`).

## e2e helpers (`e2e/helpers.ts`)

Created here, used by every later e2e file. Move nothing out of `catalog.spec.ts` (leave that file as it is). Export:

```ts
export const ADMIN_EMAIL = "admin@example.com";
export const PASSWORD = "password123";
export function readMongoUri(): string;          // same code as in catalog.spec.ts
export async function registerAs(page: Page, email: string): Promise<void>;     // same code as in catalog.spec.ts
export async function removeAdminAccount(): Promise<void>;                      // same code as in catalog.spec.ts (needs an open mongoose connection)
export async function loginAs(page: Page, email: string): Promise<void>;
// loginAs: goto("/login"); fill label "Email" and label "Password" with PASSWORD; click button "Log in" (exact: true);
// then `await page.waitForURL("/")`. The user must already exist.
```

## Required tests

`activity.service.test.ts` (real in-memory MongoDB; use `createUser`, `createAdmin`, `createActivityLog`, `setTestNow`)
- [ ] log › saves one row with every given field → DB row has `action`, `actorRole "admin"`, `actorUserId`, `subjectUserId`, `targetType "theme"`, `targetId`, `summary`, and `createdAt` equal to the fixed `now()` (`setTestNow(new Date("2026-11-01T10:00:00Z"))`)
- [ ] log › saves omitted nullable fields as null → a `system` entry with only `action`, `actorRole`, `summary`: `actorUserId`, `subjectUserId`, `targetType`, `targetId` are all `null`
- [ ] log › refuses a system entry that has an actor user → inside `withTransaction`: rejects with Error message `"A system activity entry cannot have an actor user."`; 0 rows
- [ ] log › is rolled back with its transaction → `withTransaction(async (session) => { await log(valid, session); throw new Error("boom"); })` rejects with "boom"; 0 rows
- [ ] log › throws inside a transaction when the summary is invalid → summary `"x"` with a session: rejects (Mongoose ValidationError, `name "ValidationError"`); 0 rows
- [ ] log › never throws outside a transaction → summary `"x"` without session: resolves; 0 rows; `console.error` spy called once with first argument `"activity log failed"` and second `"order_paid"`
- [ ] activity model › keeps rows for one year → `await ActivityLogModel.init()`; `ActivityLogModel.collection.indexes()` has an index with `key { createdAt: 1 }` and `expireAfterSeconds 31536000`
- [ ] listActivity › returns the newest first with 20 per page → 25 rows with different `createdAt`: page 1 has 20 items (first = newest), page 2 has 5, `totalPages 2`, `total 25`
- [ ] listActivity › returns an empty page above the last page → page 3 of 25 rows: `items []`, `totalPages 2`
- [ ] listActivity › filters by action → rows `order_paid` and `feedback_sent`; filter `order_paid` gives only the first
- [ ] listActivity › filters by customer email ignoring case and spaces → rows about customer A and B; `customerEmail " " + A.email.toUpperCase() + " "` gives only A's rows
- [ ] listActivity › combines the action and customer filters → A has an `order_paid` and a `feedback_sent` row; both filters give only the `order_paid` row
- [ ] listActivity › returns an empty list for an email that no customer has → rows exist; `customerEmail "nobody@example.com"` gives `items []`, `total 0`, `totalPages 0`
- [ ] listActivity › labels the actor → `system` row "System", `admin` row "Admin", `customer` row = the customer's name, `customer` row whose user id has no user = "Unknown customer"

`dates.test.ts` (append)
- [ ] formatDateTime › formats UTC date and 24-hour time → `new Date("2026-10-27T14:05:00Z")` gives `"Oct 27, 2026, 14:05"`; `new Date("2026-10-27T00:05:00Z")` gives `"Oct 27, 2026, 00:05"`

`auth.service.test.ts` (append)
- [ ] registerUser › logs one user_registered row → after `registerUser`, 1 activity row: `action "user_registered"`, `actorRole "customer"`, `actorUserId` and `subjectUserId` = the new user id, `targetType "user"`, `targetId` = the user id, `summary "Customer registered: <name>"`

`user.service.test.ts` (append)
- [ ] getUserIdByEmail › finds a user by email ignoring case and spaces; returns null for an unknown email
- [ ] getUserNames › returns a map of id → name and leaves out unknown and invalid ids

`activity.schemas.test.ts` / `activity.mapper.test.ts`
- [ ] activitySearchParamsSchema › keeps a valid action and a trimmed customer
- [ ] activitySearchParamsSchema › falls back for a bad action, `page=0` and `page=abc` → `action undefined`, `page 1`
- [ ] toActivityLogDTO › builds the admin path of the target → `{ targetType: "theme", targetId }` gives `/admin/themes/<id>`; `"order"` gives `/admin/orders/<id>`; `"user"` gives `/admin/customers/<id>`
- [ ] toActivityLogDTO › gives no link for `notification_job` or for a row without target → `targetPath null`

`e2e/activity.spec.ts` (needs MongoDB from docker compose)
Seed in `beforeAll` (connect with `mongoose.connect(readMongoUri())`, call `removeAdminAccount()`): a customer with
`UserModel.create({ name: "Activity Customer <RUN_ID>", email: "activity-<RUN_ID>@example.com", emailVerified: true })` and three
`ActivityLogModel.create` rows with explicit `createdAt` (now − 3, 2 and 1 minutes):
A `order_paid`, `system`, `subjectUserId` = customer, summary `"Order paid: Aurora <RUN_ID> ($29.00)"`;
B `version_released`, `admin`, summary `"Version released: Aurora <RUN_ID> 1.0.0"`;
C `feedback_sent`, `customer`, `actorUserId` and `subjectUserId` = customer, summary `"Feedback sent: Hello <RUN_ID>"`.
Then create the admin account once: open a page from the `browser` fixture, `registerAs(page, ADMIN_EMAIL)`, close it.
`afterAll`: delete the three rows (summary regex `<RUN_ID>`), the customer, then `mongoose.disconnect()`.
Find rows with `page.getByRole("row").filter({ hasText: RUN_ID })`.
- [ ] admin sees the rows newest first with actor names → `loginAs(page, ADMIN_EMAIL)`, open `/admin/activity`; 3 rows with `RUN_ID`; the first contains "Feedback sent" and "Activity Customer <RUN_ID>", the second contains "Admin", the third contains "System"
- [ ] filtering by action shows only that action → select "Order paid" in "Action", click "Apply"; URL contains `action=order_paid`; exactly 1 row with `RUN_ID`, and it contains "Order paid"
- [ ] filtering by customer email shows only that customer's rows → fill "Customer email" with the customer's email, click "Apply"; exactly 2 rows with `RUN_ID` (A and C); no row contains "Version released"
- [ ] a non-admin opening `/admin/activity` gets "Page not found" → `registerAs` a new customer `activity-viewer-<RUN_ID>@example.com`, open the page, heading "Page not found"

Break check (≥ 3): remove the `session` argument from the insert in `log`; remove the `catch` in `log` (outside a transaction);
remove the `subjectUserId` filter in `findActivityLogs`; remove the lowercase in `getUserIdByEmail`.

## Do NOT

- Do not add any field or index that is not in 03 §15. Do not add update or delete functions for the log.
- Do not call `activityService.log` from any other feature in this task.
- Do not import `activity-log.repository.ts` or `activity-log.model.ts` from another feature.
- `activity.service.ts` must not import from `next/*`. Feature components and pages: layout classes only (`pnpm check:styles`).
- No `any`, no `@ts-ignore`, no `eslint-disable`.
- Never log the `summary` of an entry.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-005: activity log`
