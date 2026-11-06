# T-017: Admin customers (disable, enable, give and remove themes) and announcements

- Depends on: T-016 (and so T-005 … T-015, all merged into `main`)
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2.3, 5, 7, 8, 9; `docs/03-data-model.md` sections 3 (extra user fields, `session`), 8 (ownership rules), 13, 15, 19 ("Admin grants / revokes a theme", "Admin disables an account", "Admin sends an announcement");
  `docs/05-pages.md` section 5 (rows `/admin/customers`, `/admin/customers/[id]`, `/admin/notifications`, `/admin/notifications/new`);
  `docs/00-product.md` 4.3, 4.7; `docs/01-decisions.md` D-012, D-112, D-116, D-118, D-120, D-121, D-122; `docs/09-emails.md` 5 (esp. 5.5 Retry); `docs/10-testing.md` sections 2, 8 (flows 5 and 7).
  Copy the layer pattern of `src/features/categories/` and the admin list pattern of `src/app/admin/themes/page.tsx`.

## Goal

The owner can find a customer, see everything about them, **disable / enable** the account (D-120: they cannot log in, all
their sessions are deleted, their data stays), **give a theme** (manual grant, D-012) and **remove a theme** (revoke any
ownership with a reason, D-122), and **send an announcement** (D-112) that is processed in batches by the cron route (D-116).

**Not in this task:** the processing of jobs (T-014 does it); the order and wallet admin pages (T-013, T-018); a link from an
order row to `/admin/orders/<id>` (T-018 adds it); editing a customer's name, email or country; deleting accounts; any email to
the customer when an account is disabled or a theme is given.

## Files

```
src/features/users/
  user.repository.ts            (change) add findUsers, countUsers, findUserByEmail, setUserDisabled, setUserEnabled, deleteSessionsOfUser
  user.service.ts               (change) add listCustomers, findCustomerByEmail, disableUser, enableUser
  customer-admin.service.ts     (new) getCustomerForAdmin: everything the customer page shows
  user.mapper.ts                (new)
  user.schemas.ts               (new)
  user.constants.ts             (new)
  user.types.ts                 (change) add the DTO types below
  user.actions.ts               (new) disableCustomerAction, enableCustomerAction
  user.service.test.ts          (change) ONLY add the tests below
  customer-admin.service.test.ts (new)
  user.schemas.test.ts          (new)
  components/admin/CustomerTable.tsx
  components/admin/CustomerDetails.tsx
  components/admin/DisableCustomerForm.tsx     ("use client")
  components/admin/EnableCustomerForm.tsx      ("use client")
  components/admin/CustomerOwnedThemes.tsx
  components/admin/CustomerOrdersSection.tsx
  components/admin/CustomerWalletSection.tsx
  components/admin/CustomerFeedbackSection.tsx
  components/admin/CustomerActivitySection.tsx

src/features/ownerships/
  ownership.repository.ts       (change) add upsertAdminGrantOwnership, revokeActiveOwnership, countActiveByUsers, listActiveByUser
  ownership.service.ts          (change) add grantThemeToCustomer, revokeOwnershipByAdmin, countActiveOwnershipsByUser, listOwnershipsForAdmin
  ownership.schemas.ts          (create, or add to the file if T-009 made it) grantThemeSchema, revokeOwnershipSchema
  ownership.actions.ts          (create, or add to the file if T-009 made it) grantThemeAction, revokeOwnershipAction
  ownership.types.ts            (change) add OwnershipAdminRowDTO
  ownership.service.test.ts     (change) ONLY add the tests below
  components/admin/GrantThemeForm.tsx          ("use client")
  components/admin/RevokeOwnershipForm.tsx     ("use client")

src/features/notifications/
  announcement.constants.ts
  announcement.schemas.ts
  announcement.types.ts
  announcement.service.ts       sendAnnouncement, listAnnouncementJobs
  announcement.actions.ts       sendAnnouncementAction
  announcement.service.test.ts
  announcement.schemas.test.ts
  notification-job.repository.ts (change) add findAnnouncementJobsPage, countAnnouncementJobs, findJobById, resetFailedJob
  notification-job.service.ts   (change) add retryNotificationJob
  notification.actions.ts       (change) add retryNotificationJobAction
  components/admin/AnnouncementForm.tsx        ("use client")
  components/admin/AnnouncementTable.tsx
  components/admin/RetryJobButton.tsx          ("use client")

src/features/themes/theme.service.ts          (change) add listThemeOptionsForAdmin(): Promise<{ id: string; name: string; status: ThemeStatus }[]> (all themes, any status, sorted by name with `collation({ locale: "en" })`; repository function `findAllThemeOptions`)
src/features/themes/theme.repository.ts       (change) add findAllThemeOptions
src/features/themes/theme.service.test.ts     (change) ONLY add the 1 test below

src/app/admin/customers/page.tsx
src/app/admin/customers/[id]/page.tsx
src/app/admin/notifications/page.tsx
src/app/admin/notifications/new/page.tsx
e2e/admin-customers.spec.ts
e2e/announcements.spec.ts
```

**Functions of earlier tasks used here (names are not repeated in the docs):**
- `activityService.log(entry, session?)` — T-005. **[PLANNER 17-D]** Planner: confirm the name and parameters. Field names are the ones of 03 §15 (`action`, `actorRole`, `actorUserId`, `subjectUserId`, `targetType`, `targetId`, `summary`). The customer page also needs the newest 20 activity rows of one customer: **[PLANNER 17-D]** write the exact call of the T-005 function behind `/admin/activity` with the customer filter (`subjectUserId`), page 1.
- `getUserSummaries(userIds)` — T-016.
- `listOrdersForUser(userId, 1)` (T-012, first page), `listWalletPaymentsForUser(userId)` (T-013), `listFeedbackForUser(userId)` (T-016). Map the fields you need from the DTOs these return (read their `*.types.ts`). If a needed field is missing, stop and write a question in `docs/QUESTIONS.md`.
- `createAnnouncementJob` — T-007 (09 §1: `notification-job.service.ts`). **[PLANNER 17-E]** Planner: write its exact parameters here, say whether it already writes the `announcement_sent` activity row (if it does, this task must not write a second one), and give the names of the audience constants of T-007.
- `retryNotificationJobAction` and a retry service function: **[PLANNER 17-E]** may already exist from T-008 or T-014. Search the code first. If they exist, reuse them and do not duplicate; if not, create them as specified here.
- Ownership admin grant/revoke: **[PLANNER 17-F]** T-009 may already contain `grantByAdmin` / `revokeByAdmin`-like functions. This task assumes it does **not**. Search `ownership.service.ts` first; if equivalent functions exist, reuse them and keep only what is missing.

Account-page rules do not apply here (admin pages). Admin pages get `AdminShell` from `src/app/admin/layout.tsx`.

## Packages

None.

## Part 1 — Customers

### Constants (`user.constants.ts`)

```ts
export const CUSTOMERS_PER_PAGE = 20;                      // 02 §7
export const DISABLE_REASON_MIN = 1;                       // 05 §5: reason 1–300 chars
export const DISABLE_REASON_MAX = 300;                     // 03 §3 disabledReason
export const REVOKE_NOTE_MIN = 1;                          // 05 §5: required note 1–300 chars
export const REVOKE_NOTE_MAX = 300;                        // 03 §8 revokeNote
export const GRANT_NOTE_MAX = 300;                         // 03 §8 grantNote
export const CUSTOMER_STATUS_FILTERS = ["active", "disabled"] as const;
export type CustomerStatusFilter = (typeof CUSTOMER_STATUS_FILTERS)[number];
export const CUSTOMER_SEARCH_MAX = 80;
```

### Messages (all in `user.constants.ts` as `CUSTOMER_MESSAGES`)

**[PLANNER 17-B]** The docs give no text for these refusals. Recommended codes and texts:

| Key | Code | Text |
|---|---|---|
| `notFound` | NOT_FOUND | `"Customer not found."` |
| `ownAccount` | FORBIDDEN | `"You cannot disable your own account."` (05 §5 hides the button for the admin's own account; the service must refuse it too) |
| `alreadyDisabled` | CONFLICT | `"This account is already disabled."` |
| `notDisabled` | CONFLICT | `"This account is not disabled."` |

**[PLANNER 17-A]** Validation texts the docs do not give. Recommended: disable reason `"Write a reason (1 to 300 characters)."`;
revoke note `"Write a note (1 to 300 characters)."`; grant note `"Use up to 300 characters."`; customer list empty state `"No customers found."`;
empty sections on the customer page `"This customer owns no themes."`, `"No orders yet."`, `"No wallet payments yet."`, `"No feedback yet."`, `"No activity yet."`.

### Repository additions (`user.repository.ts`)

`user.repository.ts` stays the only file that touches the `user` collection with Mongoose (03 §3). It writes only our extra fields. Every function calls `connectDB()` first; writes take `session?: ClientSession`.

| Function | Does |
|---|---|
| `findUsers({ q, status }, page, pageSize)` / `countUsers({ q, status })` | `q`: `$or` of `name` and `email` with `new RegExp(escapeRegex(q), "i")`; `status "active"` → `{ disabled: { $ne: true } }`, `"disabled"` → `{ disabled: true }`; newest first (`createdAt: -1, _id: -1`); `.lean()` |
| `findUserByEmail(email)` | `findOne({ email: <trimmed, lowercased> })` or `null` |
| `setUserDisabled(id, reason, at, session?)` | `$set: { disabled: true, disabledReason: reason, disabledAt: at }` |
| `setUserEnabled(id, session?)` | `$set: { disabled: false, disabledReason: null, disabledAt: null }` |
| `deleteSessionsOfUser(id, session?)` | `mongoose.connection.collection("session").deleteMany({ userId: toObjectId(id) }, { session })` (Better Auth's collection; `userId` is an ObjectId there, 03 §3). Returns nothing. |

### DTOs (`user.types.ts`, `user.mapper.ts`)

```ts
export type CustomerListItemDTO = { id: string; name: string; email: string; country: string | null; ownedCount: number; createdAt: Date; isDisabled: boolean };
export type CustomerDetailDTO = { id: string; name: string; email: string; emailVerified: boolean; country: string | null; createdAt: Date;
                                  isDisabled: boolean; disabledReason: string | null; disabledAt: Date | null };
export type CustomerPageDTO = { items: CustomerListItemDTO[]; page: number; totalPages: number; total: number };
// Rows on the customer page (own types, filled from the DTOs of other features inside customer-admin.service.ts)
export type CustomerOrderRowDTO = { id: string; themeName: string; method: "card" | "wallet"; currency: "usd" | "egp"; totalAmount: number; status: string; paidAt: Date };
export type CustomerWalletRowDTO = { id: string; themeName: string; amountEgp: number; referenceCode: string; status: string };
export type CustomerFeedbackRowDTO = { id: string; subject: string; status: FeedbackStatus; createdAt: Date };
export type CustomerActivityRowDTO = { id: string; createdAt: Date; summary: string };
export type CustomerAdminPageDTO = { customer: CustomerDetailDTO; ownerships: OwnershipAdminRowDTO[]; orders: CustomerOrderRowDTO[];
                                     walletPayments: CustomerWalletRowDTO[]; feedback: CustomerFeedbackRowDTO[]; activity: CustomerActivityRowDTO[] };
```
Mapper: `toCustomerListItemDTO(user, ownedCount)`, `toCustomerDetailDTO(user)` (`_id` → `id`, `disabled` → `isDisabled`, `country ?? null`).
`OwnershipAdminRowDTO` (in `ownership.types.ts`): `{ themeId: string; themeName: string; source: "purchase" | "admin_grant"; grantNote: string | null }`.

### Service (`user.service.ts` additions and `customer-admin.service.ts`)

| Function | Rules / errors |
|---|---|
| `listCustomers({ q, status, page }): Promise<CustomerPageDTO>` | 20 per page, newest joined first; `ownedCount` of each row from `countActiveOwnershipsByUser(ids)` (ownerships service; **active** ownerships only). Admin accounts are listed like everyone else. |
| `findCustomerByEmail(email): Promise<{ id: string } \| null>` | trims and lowercases; used by announcements |
| `disableUser(userId, reason, adminUserId)` | checks in this order: 1) user exists, else NOT_FOUND `notFound`; 2) `userId !== adminUserId`, else FORBIDDEN `ownAccount`; 3) not already disabled, else CONFLICT `alreadyDisabled`. Then **one transaction** (03 §19): `setUserDisabled(userId, reason, now())`, `deleteSessionsOfUser(userId)`, `activityService.log({ action: "account_disabled", actorRole: "admin", actorUserId: adminUserId, subjectUserId: userId, targetType: "user", targetId: userId, summary }, session)`. Other users' sessions are untouched. |
| `enableUser(userId, adminUserId)` | user exists else NOT_FOUND; must be disabled else CONFLICT `notDisabled`. One transaction: `setUserEnabled`, log `account_enabled` (same fields as above). |
| `getCustomerForAdmin(id): Promise<CustomerAdminPageDTO \| null>` (in `customer-admin.service.ts`) | `null` for an unknown or invalid id (use `findUserById`; it must not throw for a bad id — use `parseObjectId` first). Otherwise runs these in parallel and maps them: `listOwnershipsForAdmin(id)`, `listOrdersForUser(id, 1)`, `listWalletPaymentsForUser(id)`, `listFeedbackForUser(id)`, the activity call of 17-D (newest 20). |

Disabled-user behaviour is already built in T-003 (the session hook and `getCurrentUser`); do not change `auth.ts`.

**Activity summaries — [PLANNER 17-D]** The docs only give one example summary. Recommended texts (2–300 characters, no secrets):
`"Account disabled: <email>"`, `"Account enabled: <email>"`, `"Theme granted: <theme name> to <email>"`,
`"Theme access removed: <theme name> from <email>"`, `"Announcement sent: <title>"`. If T-005 already put summary builders in `activity.texts.ts` (or similar), use those instead.

### Schemas (`user.schemas.ts`)

- `disableCustomerSchema`: `id` (24-hex string), `reason` trim, 1–300 (17-A message).
- `customerSearchParamsSchema` for the list page: `q: z.string().trim().max(80).catch("")`, `status: z.enum(CUSTOMER_STATUS_FILTERS).optional().catch(undefined)`, `page: z.coerce.number().int().min(1).catch(1)`.
- The `enableCustomerAction` needs only `id` (24-hex string).

### Actions (`user.actions.ts`)

`disableCustomerAction`, `enableCustomerAction`: signature `(previous: ActionResult | null, formData: FormData) => Promise<ActionResult>`;
`const admin = await requireAdmin()` → schema → service in try/catch (`validationFailure`, `failureFrom` with `{ reason }` as values for the disable form) →
`revalidatePath("/admin/customers")`, `revalidatePath("/admin/customers/[id]", "page")`, `revalidatePath("/admin/activity")` → `{ ok: true, data: undefined }`.

## Part 1b — Give / remove a theme (ownerships feature)

Rules come from 03 §8 and 03 §19. Both functions run in **one transaction** with the activity log.

### Repository (`ownership.repository.ts`)

| Function | Does |
|---|---|
| `upsertAdminGrantOwnership({ userId, themeId, adminUserId, note }, session?)` | `findOneAndUpdate({ userId, themeId }, { $set: { status: "active", source: "admin_grant", orderId: null, grantedByUserId: adminUserId, grantNote: note, revokedAt: null, revokedReason: null, revokedByUserId: null, revokeNote: null }, $setOnInsert: { userId, themeId, licenseType: "standard" } }, { upsert: true, returnDocument: "after", session })` — a revoked ownership is updated in place (same `_id`, 03 §8) |
| `revokeActiveOwnership({ userId, themeId, adminUserId, note, revokedAt }, session?)` | `findOneAndUpdate({ userId, themeId, status: "active" }, { $set: { status: "revoked", revokedAt, revokedReason: "admin", revokedByUserId: adminUserId, revokeNote: note } }, { returnDocument: "after", session })`; returns `null` when there was no active ownership |
| `countActiveByUsers(userIds): Promise<Map<string, number>>` | aggregate `{ $match: { status: "active", userId: { $in } } }`, `{ $group: { _id: "$userId", count: { $sum: 1 } } }`; users without rows are missing from the map |
| `listActiveByUser(userId): Promise<OwnershipRecord[]>` | active rows of one user |

### Service (`ownership.service.ts`)

| Function | Rules / errors |
|---|---|
| `grantThemeToCustomer({ userId, themeId, note }, adminUserId)` | customer must exist (`getUserSummaries([userId])`), else NOT_FOUND `CUSTOMER_MESSAGES.notFound`; theme must exist (`getThemeForAdmin`, any status), else NOT_FOUND `"Theme not found."`; an **active** ownership exists → CONFLICT `"This customer already owns this theme."` (03 §8, nothing written, no log). Otherwise `upsertAdminGrantOwnership` and log `ownership_granted` (`actorRole "admin"`, `actorUserId` = admin, `subjectUserId` = customer, `targetType "theme"`, `targetId` = theme id) in the same transaction. A purchased-then-revoked ownership is re-activated as an admin grant (same document). `note` empty → `null`. |
| `revokeOwnershipByAdmin({ userId, themeId, note }, adminUserId)` | `revokeActiveOwnership`; `null` (no active ownership: never owned or already revoked) → CONFLICT `"This customer does not own this theme."` (03 §8, nothing written, no log). Else log `ownership_revoked` (same fields). Works for **any** active ownership, purchase or grant (D-122). It does not touch the order, `salesCount` or the downloads logs. |
| `countActiveOwnershipsByUser(userIds)` | repository `countActiveByUsers` |
| `listOwnershipsForAdmin(userId): Promise<OwnershipAdminRowDTO[]>` | active ownerships of the customer with the theme name (from `listThemeOptionsForAdmin`, matched by id), sorted by theme name |

**[PLANNER 17-C]** The docs say "select theme + note" without saying (a) whether the grant note is required and (b) which themes can be chosen.
Recommended: (a) the grant note is **optional** (03 §8 `grantNote` is nullable; `GRANT_NOTE_MAX` 300); (b) **all themes of any status** are in the select (`listThemeOptionsForAdmin`), each option labelled `"<name> (<status label>)"`.

### Schemas / actions

`ownership.schemas.ts`: `grantThemeSchema { userId, themeId (24-hex strings), note: z.string().trim().max(300, <17-A>) }`;
`revokeOwnershipSchema { userId, themeId, note: z.string().trim().min(1, <17-A>).max(300, <17-A>) }`.
`ownership.actions.ts`: `grantThemeAction`, `revokeOwnershipAction` — `requireAdmin()`, schema, service in try/catch, revalidate `/admin/customers/[id]` (page), `/admin/customers`, `/admin/activity`, `/account/themes`; result `{ ok: true, data: undefined }`.

## Part 2 — Announcements

### Constants (`announcement.constants.ts`)

```ts
export const ANNOUNCEMENT_TITLE_MIN = 2;      // 03 §13
export const ANNOUNCEMENT_TITLE_MAX = 120;
export const ANNOUNCEMENT_BODY_MIN = 2;
export const ANNOUNCEMENT_BODY_MAX = 1000;
export const ANNOUNCEMENT_LINK_MAX = 300;     // 03 §1: internalPath
export const ANNOUNCEMENT_JOBS_PER_PAGE = 20;
export const ANNOUNCEMENT_AUDIENCE_OPTIONS = [
  { value: "all_customers", label: "All customers" },     // 05 §5
  { value: "theme_owners", label: "Owners of a theme" },
  { value: "one_customer", label: "One customer" },
] as const;
export const NO_CUSTOMER_MESSAGE = "No customer with this email.";        // 05 §5, word for word
export const ANNOUNCEMENT_QUEUED_MESSAGE = "Announcement queued.";        // 05 §5, word for word
export const JOB_STATUS_LABELS = { pending: "Pending", running: "Running", done: "Done", failed: "Failed" } as const;
```
(If T-007 already exports the same limits or the audience list, import them instead of repeating — see 17-E.)

**[PLANNER 17-G]** Texts of the list. Recommended `audienceLabel`: `"All customers"`; `"Owners of <theme name>"`; `"<customer email>"`. Status labels above.

### Schema (`announcement.schemas.ts`)

`announcementInputSchema` (form field names `title`, `body`, `link`, `audience`, `themeId`, `customerEmail`, `sendEmail`):
`title` trim 2–120; `body` trim 2–1 000; `link` trim, empty → `null`, else must start with `/`, not `//`, max 300; `audience` one of the 3 values;
`themeId` trim; `customerEmail` trim; `sendEmail` boolean. Rules between fields: audience `theme_owners` needs a non-empty `themeId`; audience `one_customer` needs a non-empty `customerEmail`
(an empty or unknown email gives `NO_CUSTOMER_MESSAGE` in the service, not a second text). Fields that do not belong to the chosen audience are dropped (`themeId`/`customerEmail` become `null`).
Output type `AnnouncementInput`. Messages: **[PLANNER 17-A]** recommended: title `"Use 2 to 120 characters."`, message `"Use 2 to 1 000 characters."`, link `"Enter a path that starts with / (for example /themes)."`,
audience `"Choose who gets this announcement."`, theme `"Choose a theme."`.

### Service (`announcement.service.ts`)

| Function | Rules / errors |
|---|---|
| `sendAnnouncement(input: AnnouncementInput, adminUserId): Promise<{ id: string }>` | `theme_owners`: the theme must exist (`getThemeForAdmin`, any status), else INVALID `"Choose a theme."`. `one_customer`: `findCustomerByEmail(input.customerEmail)` must find a user, else INVALID `NO_CUSTOMER_MESSAGE`. Then in **one transaction** (03 §19): `createAnnouncementJob({ title, body, link, sendEmail, audience, audienceThemeId, audienceUserId, createdByUserId: adminUserId }, session)` (17-E) and, unless 17-E says that function logs it, `activityService.log({ action: "announcement_sent", actorRole: "admin", actorUserId: adminUserId, subjectUserId: <audienceUserId or null>, targetType: "notification_job", targetId: <job id>, summary }, session)`. **Nothing is sent or created for users in this request** (D-116): no notifications, no emails. |
| `listAnnouncementJobs(page): Promise<AnnouncementJobPageDTO>` | only jobs with `kind "announcement"`, newest first, 20 per page. DTO row: `{ id, createdAt, title, audienceLabel, status, notifiedCount, emailedCount, error: string \| null }` (`error` only for `failed`, else `null`). Labels as in 17-G, theme names from `listThemeOptionsForAdmin`, customer email from `getUserSummaries`. |
| `retryNotificationJob(jobId)` (in `notification-job.service.ts`) | job not found or invalid id → NOT_FOUND `"Notification job not found."`; `status !== "failed"` → CONFLICT `"Only failed jobs can be retried."`; else `resetFailedJob`: `status "pending"`, `attempts 0`, `error null`, **cursor kept** (09 §5.5). |

**[PLANNER 17-B]** The two retry texts above are recommendations (the docs give none).

### Actions

- `sendAnnouncementAction` (`announcement.actions.ts`): `requireAdmin()`; reads the 7 fields (`readText`, `readCheckbox` for `sendEmail`); schema; `sendAnnouncement`; revalidate `/admin/notifications`, `/admin/activity`; then `redirect("/admin/notifications?queued=1")` (outside `try/catch`). On failure these values are sent back so the form keeps them: `title`, `body`, `link`, `audience`, `themeId`, `customerEmail`.
- `retryNotificationJobAction` (`notification.actions.ts`): `requireAdmin()`; reads `jobId`; `retryNotificationJob`; revalidate `/admin/notifications` and `revalidatePath("/admin/themes/[id]/versions", "page")`; `{ ok: true, data: undefined }`.

## Pages and components

All admin pages call `requireAdmin()` and export `metadata` with `robots: { index: false }`; titles `Customers · Theme Store`, `Customer · Theme Store`, `Notifications · Theme Store`, `New announcement · Theme Store`.

**`/admin/customers?q=&status=&page=`** — copy the structure of `app/admin/themes/page.tsx`: Heading level 1 "Customers"; tab links (`ButtonLink size="sm"`) "All", "Active", "Disabled"; GET search form (`TextField` "Search", `Button` "Search", keeps `status`);
`CustomerTable` columns Name (`TextLink` → `/admin/customers/<id>`), Email, Country (the 2-letter code, or `—`), Themes owned, Joined (`formatDate`), Status (`Badge`: "Active" tone success / "Disabled" tone danger); `Pagination` keeping the params. Empty: Text of 17-A.

**`/admin/customers/[id]`** — `getCustomerForAdmin(id)`; `null` → `notFound()`. `Stack gap="lg"`:
1. Heading level 1 = name, Badge Active / Disabled (`CustomerDetails` shows: Email + "verified"/"not verified", Country, Joined, and when disabled the reason and `formatDate(disabledAt)`).
2. Section "Owned themes" (`CustomerOwnedThemes`): per row: theme name (`TextLink` → `/admin/themes/<themeId>`), source ("Purchase" / "Admin grant"), the grant note when present, and `RevokeOwnershipForm` (hidden `userId`, `themeId`; `TextField` "Note"; `SubmitButton variant="danger" size="sm"` "Remove access" / `"Removing…"`). Empty text of 17-A.
3. `GrantThemeForm` (hidden `userId`; `SelectField` "Theme" with `listThemeOptionsForAdmin()` options, placeholder "Choose a theme"; `TextField` "Note"; `SubmitButton` "Give a theme" / `"Giving…"`; success `Alert` — result message **[PLANNER 17-A]** recommended `"Theme given."`).
4. Sections "Orders" (`CustomerOrdersSection`: Date `formatDate(paidAt)`, Theme, Method "Card"/"Wallet", Total `formatPrice(totalAmount, currency)`, Status as the labels of `/account/orders`), "Wallet payments" (`CustomerWalletSection`: Reference, Theme, Amount `formatPrice(amountEgp * 100, "egp")`, Status, `TextLink` "Review" → `/admin/wallet-payments/<id>`), "Feedback" (`CustomerFeedbackSection`: Date, Subject as `TextLink` → `/admin/feedback/<id>`, Status label from `FEEDBACK_ADMIN_STATUS_LABELS`), "Recent activity" (`CustomerActivitySection`: Date, Summary). Each uses `Table` and its empty text of 17-A. Reuse the existing status label constants of T-012/T-013 (do not copy them).
5. Account status: when enabled **and** `customer.id !== admin.id` → `DisableCustomerForm` (hidden `id`; `TextField` "Reason"; `SubmitButton variant="danger"` "Disable account" / `"Disabling…"`). When disabled → `EnableCustomerForm` (hidden `id`; `SubmitButton` "Enable account" / `"Enabling…"`). The admin's own account shows neither button when it is enabled (05 §5).

Form components use `useActionState(action, null)`, `FormError`, `submittedValue`/`formKey` like `CategoryForm.tsx`.

**`/admin/notifications?page=`** — Heading level 1 "Notifications"; `ButtonLink` "New announcement" → `/admin/notifications/new`; when `?queued=1` show `Alert tone="success"` with `ANNOUNCEMENT_QUEUED_MESSAGE`;
`AnnouncementTable` columns Date (`formatDate`), Title, Audience, Status (`Badge`; tones pending `neutral`, running `primary`, done `success`, failed `danger`), Notified, Emailed, and for `failed` rows the error text (`Text size="sm" tone="danger"`) and `RetryJobButton` (hidden `jobId`; `SubmitButton size="sm"` "Retry" / `"Retrying…"`). Empty: Text `No announcements yet.` **[PLANNER 17-A]**. `Pagination`.

**`/admin/notifications/new`** — Heading level 1 "New announcement"; `AnnouncementForm`: `TextField` "Title", `TextAreaField` "Message" (rows 5), `TextField` "Link" (hint `"Optional. A page of this store, for example /themes."` — **[PLANNER 17-A]** recommended), `SelectField` "Audience" (options `ANNOUNCEMENT_AUDIENCE_OPTIONS`, default `all_customers`);
when "Owners of a theme" is chosen show `SelectField` "Theme" (options from `listThemeOptionsForAdmin`, placeholder "Choose a theme"); when "One customer" is chosen show `TextField` "Customer email" (`type="email"`); `CheckboxField` "Also send by email" (hint: `"Only customers who have announcement emails turned on get the email."` — recommended 17-A); `SubmitButton` "Send announcement" / `"Sending…"`. The audience-dependent fields are shown with component state; the theme options are passed in as a prop by the page.

## Required tests

`user.service.test.ts` (add; real in-memory MongoDB; sessions made with `registerUser` + `loginUser` from `auth.service` and `new Headers()`; read sessions with `mongoose.connection.collection("session")`)
- [ ] listCustomers › finds by name or email, ignoring case, and treats regex characters as text → `"a+b"` does not throw and matches only a literal `a+b`
- [ ] listCustomers › filters active and disabled → 1 disabled + 2 active users: `status "disabled"` returns 1, `"active"` returns 2
- [ ] listCustomers › newest joined first, 20 per page → 25 users: page 1 has 20, page 2 has 5, `totalPages` 2
- [ ] listCustomers › counts only active ownerships → one active and one revoked ownership give `ownedCount` 1
- [ ] disableUser › saves the flags, deletes that user's sessions only and logs it → user: `disabled true`, `disabledReason`, `disabledAt = now()` (`setTestNow`); 0 sessions for that user, the other user's session still there; 1 `activityLogs` row `account_disabled` with `actorUserId` = admin, `subjectUserId` = user, `targetType "user"`
- [ ] disableUser › refuses the admin's own account → FORBIDDEN `"You cannot disable your own account."`; user unchanged; 0 activity rows
- [ ] disableUser › refuses an already disabled account and an unknown id → CONFLICT `"This account is already disabled."` (no second activity row, `disabledAt` unchanged) and NOT_FOUND `"Customer not found."`
- [ ] disableUser › a disabled customer cannot log in → after `disableUser`, `loginUser` rejects with FORBIDDEN and the text of `AUTH_MESSAGES.disabled`; 0 sessions
- [ ] enableUser › clears the flags, logs it and lets the customer log in again → `disabled false`, `disabledReason null`, `disabledAt null`; 1 `account_enabled` row; `loginUser` succeeds and creates 1 session
- [ ] enableUser › refuses an account that is not disabled → CONFLICT `"This account is not disabled."`; 0 activity rows

`customer-admin.service.test.ts`
- [ ] getCustomerForAdmin › returns the customer's own data only → details; 1 active ownership (the revoked one is not listed) with theme name and source; only this customer's feedback; activity rows of this customer (newest first)
- [ ] getCustomerForAdmin › returns null for an unknown and an invalid id

`ownership.service.test.ts` (add; `createUser`, `createAdmin`, `createTheme`, `createOwnership`)
- [ ] grantThemeToCustomer › creates an admin-grant ownership and logs it → row: `status "active"`, `source "admin_grant"`, `grantedByUserId` = admin, `grantNote`, `orderId null`, `licenseType "standard"`; 1 `ownership_granted` row (`subjectUserId` = customer, `targetType "theme"`, `targetId` = theme)
- [ ] grantThemeToCustomer › re-activates a revoked ownership in place → same `_id`; `status "active"`, `source "admin_grant"`, all `revoked*` fields `null`; still 1 ownership row
- [ ] grantThemeToCustomer › refuses a customer who already owns the theme → CONFLICT `"This customer already owns this theme."`; ownership unchanged; 0 activity rows
- [ ] grantThemeToCustomer › refuses an unknown customer and an unknown theme → NOT_FOUND `"Customer not found."` and NOT_FOUND `"Theme not found."`; 0 ownership rows
- [ ] revokeOwnershipByAdmin › revokes with the admin reason and note and logs it → `status "revoked"`, `revokedReason "admin"`, `revokedByUserId` = admin, `revokeNote`, `revokedAt = now()`; 1 `ownership_revoked` row
- [ ] revokeOwnershipByAdmin › refuses an ownership that is already revoked or never existed → CONFLICT `"This customer does not own this theme."`; ownership unchanged; 0 activity rows
- [ ] revokeOwnershipByAdmin › revokes a purchased ownership and leaves the order and `salesCount` alone → order `status` still `"paid"`, theme `stats.salesCount` unchanged

`theme.service.test.ts` (add)
- [ ] listThemeOptionsForAdmin › returns every theme of any status sorted by name → draft, published and unpublished all present, `{ id, name, status }`

`announcement.service.test.ts` (real DB, `FakeEmailSender`)
- [ ] sendAnnouncement › queues one pending job and logs it, and sends nothing → 1 `notificationJobs` row: `kind "announcement"`, `status "pending"`, title/body/link/sendEmail/audience stored, `createdByUserId` = admin; 1 `announcement_sent` row (`targetType "notification_job"`); 0 `notifications`; `fakeEmailSender.sent` is empty
- [ ] sendAnnouncement › refuses an unknown theme and an unknown customer email → INVALID `"Choose a theme."` and INVALID `"No customer with this email."`; 0 jobs
- [ ] sendAnnouncement › finds the customer by email ignoring case and spaces → `audienceUserId` = that user, `audience "one_customer"`
- [ ] listAnnouncementJobs › lists only announcement jobs, newest first, with audience labels and the error of failed jobs → a `version_released` job is not listed; labels `"All customers"`, `"Owners of <theme name>"`, `"<email>"`; `error` filled only for the failed one
- [ ] retryNotificationJob › resets a failed job and keeps its cursor → `status "pending"`, `attempts 0`, `error null`, `cursor` unchanged
- [ ] retryNotificationJob › refuses a job that is not failed and an unknown id → CONFLICT `"Only failed jobs can be retried."` (job unchanged) and NOT_FOUND `"Notification job not found."`

`user.schemas.test.ts` / `announcement.schemas.test.ts`
- [ ] disableCustomerSchema › requires a reason of 1 to 300 characters → `""` and a 301-character reason are refused with the 17-A message; 300 is accepted; the reason is trimmed
- [ ] announcementInputSchema › applies the field rules → title 1 and 121 characters refused; link `"//evil.com"` and `"https://x.com"` refused, `"/themes"` accepted, `""` becomes `null`; audience `theme_owners` without `themeId` refused; unused audience fields become `null`

`e2e/admin-customers.spec.ts` (flow 5; style of `e2e/catalog.spec.ts`: `RUN_ID`, `registerAs`, admin `removeAdminAccount`; customer and admin use two browser contexts)
- [ ] an admin disables a customer and that customer can no longer log in
      Customer registers (`customer-${RUN_ID}@example.com`, name `E2E Person`). Admin registers as `admin@example.com`, opens `/admin/customers?q=<customer email>`, in the row containing the email clicks the name link,
      fills "Reason" with `Spam`, clicks "Disable account" → the button "Enable account" is visible.
      Customer opens `/account` → redirected to a URL starting with `/login` (the session was deleted). Customer logs in with the right password → the text `This account has been disabled. Contact support if you think this is a mistake.` is visible.
      Admin clicks "Enable account" → customer logs in again and `/account` shows `Hi E2E Person`.

`e2e/announcements.spec.ts` (flow 7; read `CRON_SECRET` from `.env` with `process.loadEnvFile(".env")` like `readMongoUri`)
Seed in `beforeAll`: one category and one published theme (like catalog.spec, name contains `RUN_ID`).
- [ ] an announcement to the owners of a theme reaches only the owners
      Two customers register (`owner-${RUN_ID}@example.com`, `other-${RUN_ID}@example.com`). Admin registers, opens the owner's customer page (search by email, click the name), selects the seeded theme in "Theme", clicks "Give a theme" → the theme appears under "Owned themes" with the button "Remove access".
      Admin opens `/admin/notifications/new`, fills "Title" with `Update ${RUN_ID}` and "Message", chooses "Owners of a theme" in "Audience", chooses the seeded theme in "Theme", clicks "Send announcement" → `Announcement queued.` is visible and the table shows `Update ${RUN_ID}` with status "Pending".
      `request.post("/api/cron/process-notifications", { headers: { Authorization: "Bearer <CRON_SECRET>" } })` → status 200.
      Owner opens `/account/notifications` → `Update ${RUN_ID}` visible. Other customer opens `/account/notifications` → `Update ${RUN_ID}` is not visible (`toHaveCount(0)`).
      Cleanup in `afterAll`: delete the seeded theme and category.

Break check (≥ 3): remove `deleteSessionsOfUser` from `disableUser`; remove the `status: "active"` filter in `revokeActiveOwnership`; remove the "already owns" check in `grantThemeToCustomer`; make `sendAnnouncement` create notifications directly.

## Do NOT

- Do not write Better Auth core fields (`name`, `email`, `emailVerified`) and do not touch `auth.ts` or the session hook. Only `disabled`, `disabledReason`, `disabledAt` are written, and `session` documents are only deleted.
- Do not send or create any notification or email inside `sendAnnouncement`, `disableUser`, `enableUser`, `grantThemeToCustomer` or `revokeOwnershipByAdmin`.
- Do not create orders for admin grants (03 §7). Do not change an order, `salesCount` or a download log when revoking.
- Do not add fields, indexes, activity actions or notification types. Do not hard-delete any user, ownership or job.
- Do not import another feature's repository or model (D-087): ownerships, themes, orders, wallet payments, feedback, activity and notifications are used through their services.
- Feature components and pages: layout classes only (`pnpm check:styles`). No `any`, no `@ts-ignore`, no `eslint-disable`. Do not change or delete any existing test; only add the listed ones.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-017: admin customers and announcements`
