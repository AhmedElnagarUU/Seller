# T-007: Notifications core — models, texts, creating notification jobs

- Depends on: T-005
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2–7; `docs/03-data-model.md` sections 1, 12, 13, 19;
  `docs/09-emails.md` sections 1 (file list only), 4, 5.3 (`lockedUntil` only); `docs/01-decisions.md` D-111, D-112, D-116;
  `docs/10-testing.md`. Copy the structure of `src/features/themes` and `src/features/categories` (T-004).

Sections that contain `[PLANNER: ...]` are **not decided yet**. Build everything else, do not guess the marked part,
and add the question to `docs/QUESTIONS.md` (AGENTS.md rule).

## Goal

The database part of notifications: the two models, the text of every in-app notification, and the three functions that
**create** a notification job (the job that later reaches many people). Nothing here sends anything.

**Not in this task** (later tasks add them to this same feature):
- Processing jobs: `notification-job.processor.ts`, claiming a job, batches, the cron route and handler, constants such as
  `JOB_BATCH_SIZE` (T-014). `lockedUntil` exists on the model but nothing reads or writes it yet.
- Emails #7–#10 (`email.service.ts`), the notification center (bell, page, `NotificationList`), `notification.repository.ts`,
  `notification.service.ts` (creating a single notification, unread count, mark as read): T-012, T-014 and later.
- Admin pages `/admin/notifications`, the "Retry" button and the announcement form (T-017).
- Calling the job functions: the versions task, the publish task and the announcement task call them. These functions only
  insert the job; **they never write an activity log entry** (the caller logs in the same transaction, `03 §19`).

There is no user-visible page in this task, so there is no e2e test.

## Files

```
src/features/notifications/
  notification.model.ts             03 §12 (collection "notifications"); export NotificationModel, type NotificationRecord
  notification-job.model.ts         03 §13 (collection "notificationJobs"); export NotificationJobModel, type NotificationJobRecord
  notification.constants.ts         enums, limits (below)
  notification.types.ts             input types of the job functions, NotificationText
  notification.texts.ts             one builder per notification type (09 §4)
  notification-job.repository.ts    insertNotificationJob
  notification-job.service.ts       createVersionReleasedJob, createThemePublishedJob, createAnnouncementJob
  notification.model.test.ts / notification-job.model.test.ts / notification-job.service.test.ts / notification.texts.test.ts
```

## Packages

None.

## Constants (`notification.constants.ts`)

```ts
export const NOTIFICATION_TYPES = [
  "owned_theme_updated", "favorite_theme_updated", "category_new_theme", "announcement",
  "wallet_payment_approved", "wallet_payment_rejected", "feedback_reply",
] as const;                                                    // 03 §12, same order
export const NOTIFICATION_JOB_KINDS = ["version_released", "theme_published", "announcement"] as const;
export const NOTIFICATION_JOB_STATUSES = ["pending", "running", "done", "failed"] as const;
export const NOTIFICATION_JOB_STAGES = [
  "theme_owners", "theme_favoriters", "category_followers", "all_customers", "one_customer",
] as const;
export const ANNOUNCEMENT_AUDIENCES = ["all_customers", "theme_owners", "one_customer"] as const;
export const NOTIFICATION_TITLE_MIN = 2;      // used for the announcement title as well
export const NOTIFICATION_TITLE_MAX = 120;
export const NOTIFICATION_BODY_MIN = 2;       // used for the announcement body as well
export const NOTIFICATION_BODY_MAX = 1000;
export const NOTIFICATION_LINK_MAX = 300;
export const INTERNAL_PATH_PATTERN = /^\/(?!\/)/;                // "internalPath" format of 03 §1: starts with "/", not "//"
export const NOTIFICATION_RETENTION_SECONDS = 31_536_000;      // 1 year
export const JOB_ERROR_MAX = 500;
```
Export the types too (`NotificationType`, `NotificationJobKind`, `NotificationJobStatus`, `NotificationJobStage`,
`AnnouncementAudience`) as in 03 §1.7.

## Models

**`notification.model.ts`** — exactly 03 §12, every field commented, `{ collection: "notifications", timestamps: true }`:
`userId` (ObjectId, `ref: "User"`, required), `type` (enum `NOTIFICATION_TYPES`, required), `title` (required, trimmed, 2–120),
`body` (required, trimmed, 2–1000), `link` (string, default `null`, `match: INTERNAL_PATH_PATTERN`, `maxlength 300`),
`readAt` (Date, default `null`), `jobId` (ObjectId, `ref: "NotificationJob"`, default `null`).
Indexes, in this order:
1. `{ userId: 1, createdAt: -1 }`
2. `{ userId: 1, readAt: 1 }`
3. `{ jobId: 1, userId: 1 }` with `unique: true` and `partialFilterExpression: { jobId: { $type: "objectId" } }`
4. `{ createdAt: 1 }` with `expireAfterSeconds: NOTIFICATION_RETENTION_SECONDS`

**`notification-job.model.ts`** — exactly 03 §13 (all fields, same order, every field commented), `{ collection: "notificationJobs", timestamps: true }`:
- `kind` enum, required. `themeId` (`ref: "Theme"`), `versionId` (`ref: "Version"`), `categoryId` (`ref: "Category"`): ObjectId, default `null`.
- `announcement` sub-document (`{ _id: false }`): `title` (2–120), `body` (2–1000), `link` (`match: INTERNAL_PATH_PATTERN`, max 300), `sendEmail` (Boolean),
  `audience` (enum `ANNOUNCEMENT_AUDIENCES`), `audienceThemeId` (`ref: "Theme"`), `audienceUserId` (`ref: "User"`). Every one of them has default `null`.
- `status` enum, required, default `"pending"`. `stage` enum `NOTIFICATION_JOB_STAGES`, required (no default: the service sets it).
- `cursor` ObjectId default `null`. `notifiedCount`, `emailedCount`, `attempts`: Number, required, default `0`, `min: 0`, integer.
- `error` string default `null`, `maxlength 500`. `startedAt`, `finishedAt`, `lockedUntil`: Date default `null`.
- `createdByUserId` ObjectId `ref: "User"`, required.
- Index: `{ status: 1, createdAt: 1 }`.
- **Required-by-kind rules** (03 §13 "Required for ..."), written as ONE `pre("validate")` hook on the schema. The hook is a plain function **without** a `next` argument,
  reads values with `this.get("<path>")` and reports each missing value with `this.invalidate("<path>", "Path `<path>` is required.")` (use the full path, e.g. `announcement.title`):
  - `themeId` when `kind` is `version_released` or `theme_published`;
  - `versionId` when `kind` is `version_released`;
  - `categoryId` when `kind` is `theme_published`;
  - `announcement.title`, `announcement.body`, `announcement.sendEmail`, `announcement.audience` when `kind` is `announcement` (`sendEmail: false` counts as given; only `null` is missing);
  - `announcement.audienceThemeId` when `announcement.audience` is `theme_owners`; `announcement.audienceUserId` when it is `one_customer`.

Types with `InferSchemaType` (D-090): `NotificationRecord`, `NotificationJobRecord`.

## Job functions (`notification-job.service.ts`)

Each function takes an optional last parameter `session?: ClientSession` (it joins the caller's transaction, 02 §7), converts ids with `toObjectId`,
calls `notificationJobRepository.insertNotificationJob(fields, session)` and returns `Promise<{ id: string }>`.
All of them save: `status "pending"`, `cursor null`, `notifiedCount 0`, `emailedCount 0`, `attempts 0`, `error null`, `startedAt null`, `finishedAt null`, `lockedUntil null`.
Input types are in `notification.types.ts`.

| Function | Input | Saves |
|---|---|---|
| `createVersionReleasedJob(input, session?)` | `{ themeId, versionId, createdByUserId }` (strings) | `kind "version_released"`, `stage "theme_owners"`, `themeId`, `versionId`, `categoryId null`, announcement fields `null` |
| `createThemePublishedJob(input, session?)` | `{ themeId, categoryId, createdByUserId }` | `kind "theme_published"`, `stage "category_followers"`, `themeId`, `categoryId`, `versionId null`, announcement fields `null` |
| `createAnnouncementJob(input, session?)` | `{ title, body, link: string \| null, sendEmail: boolean, audience, audienceThemeId: string \| null, audienceUserId: string \| null, createdByUserId }` | `kind "announcement"`, `stage` = the `audience` value (`all_customers`, `theme_owners` or `one_customer`), `themeId`, `versionId`, `categoryId` all `null`, the `announcement` sub-document filled from the input |

The functions do not check that the theme, category, version or customer exists (the caller already did) and do not validate texts
(the caller's zod schema did). A missing required value is caught by the model hook (a Mongoose `ValidationError`, nothing is saved).

## Texts (`notification.texts.ts`)

`NotificationText = { title: string; body: string; link: string | null }`. One pure function per row of 09 §4 (copy the texts word for word):

| Function (input) | `title` | `body` | `link` |
|---|---|---|---|
| `buildOwnedThemeUpdatedText({ themeName, version, changeTexts })` | `<themeName> <version> is available` | see "Body of update notifications" | `/account/themes` |
| `buildFavoriteThemeUpdatedText({ themeName, themeSlug, version, changeTexts })` | `<themeName> <version> is out` | same | `/themes/<themeSlug>` |
| `buildCategoryNewThemeText({ categoryName, themeName, themeSlug, tagline })` | `New in <categoryName>: <themeName>` | `<tagline>` | `/themes/<themeSlug>` |
| `buildAnnouncementText({ title, body, link })` | `<title>` | `<body>` | `<link>`, or `null` when it is `null` |
| `buildWalletPaymentApprovedText({ themeName, amountEgp })` | `Payment approved: <themeName>` | `Your payment of <amountEgp> EGP was confirmed. You can download the theme now.` (see below) | `/account/themes` |
| `buildWalletPaymentRejectedText({ themeName, rejectionReason, walletPaymentId })` | `Payment not confirmed: <themeName>` | `Reason: <rejectionReason>` | `/account/wallet-payments/<walletPaymentId>` |
| `buildFeedbackReplyText({ subject })` | `Reply to your feedback` | `<subject>` | `/account/feedback` |

- `changeTexts` is the list of the `text` of every change of the version, in order (`string[]`, at least 1 item).
- Wallet approved body: the text is `Your payment of <amountEgp> EGP was confirmed. You can download the theme now.` Show the amount with
  `formatPrice(amountEgp * 100, "egp")` (02 §9.8: prices are always shown with `formatPrice`). That function already ends with " EGP",
  so the body is `` `Your payment of ${formatPrice(amountEgp * 100, "egp")} was confirmed. You can download the theme now.` ``
  Example: `amountEgp 1465` gives `Your payment of 1,465 EGP was confirmed. You can download the theme now.`
- **Cutting** (09 §4, last paragraph): every returned `title` is cut to at most 120 characters and every `body` to at most 1 000. A text longer than the limit
  becomes its first `limit − 1` characters followed by `…` (one character, `…`), so its length is exactly the limit. A text of exactly the limit is not cut.
  Use one private helper `cutText(text, max)` in the file. `link` is never cut.

### Body of update notifications

`[PLANNER: 09 §4 says the body of owned_theme_updated and favorite_theme_updated is "First change text, max 200 chars (+ <n> more when more)". Needed: the exact format when there are more changes (separator, spacing) and whether "max 200" cuts the first change text or the whole body. With exactly one change the body is that change text.]`

## Required tests

`notification-job.service.test.ts` (real in-memory MongoDB; ids from `createTheme`, `createCategory`, `createAdmin`, `new Types.ObjectId()` for the version)
- [ ] createVersionReleasedJob › saves a pending job at stage theme_owners → DB row: `kind "version_released"`, `stage "theme_owners"`, `status "pending"`, `themeId`, `versionId`, `categoryId null`, `cursor null`, `notifiedCount 0`, `emailedCount 0`, `attempts 0`, `error null`, `startedAt null`, `finishedAt null`, `lockedUntil null`, `createdByUserId`; `announcement` equals `{ title: null, body: null, link: null, sendEmail: null, audience: null, audienceThemeId: null, audienceUserId: null }`
- [ ] createVersionReleasedJob › returns the id of the saved job → `result.id` equals the string of the only DB row's `_id`
- [ ] createThemePublishedJob › saves a pending job at stage category_followers → `kind "theme_published"`, `stage "category_followers"`, `themeId`, `categoryId` saved, `versionId null`
- [ ] createAnnouncementJob › for all customers starts at stage all_customers → `kind "announcement"`, `stage "all_customers"`, `announcement.title`, `body`, `link null`, `sendEmail true`, `audience "all_customers"`; `themeId`, `versionId`, `categoryId` are `null`
- [ ] createAnnouncementJob › for theme owners starts at stage theme_owners → `stage "theme_owners"`, `announcement.audienceThemeId` saved, `audienceUserId null`, `sendEmail false` kept as `false`
- [ ] createAnnouncementJob › for one customer starts at stage one_customer → `stage "one_customer"`, `announcement.audienceUserId` saved, `link "/account/themes"` kept
- [ ] createAnnouncementJob › refuses theme owners without a theme → rejects with `name "ValidationError"` and `errors` containing the key `announcement.audienceThemeId`; 0 jobs
- [ ] job functions › are rolled back with the caller's transaction → `withTransaction(async (session) => { await createVersionReleasedJob(input, session); throw new Error("boom"); })` rejects with "boom"; 0 jobs

`notification-job.model.test.ts` (create with `NotificationJobModel.create`; every refusal: rejects with `name "ValidationError"`, `errors` has the key shown, 0 rows)
- [ ] refuses a version_released job without a version → key `versionId`
- [ ] refuses a version_released job without a theme → key `themeId`
- [ ] refuses a theme_published job without a category → key `categoryId`
- [ ] refuses an announcement without title, body, sendEmail and audience → keys `announcement.title`, `announcement.body`, `announcement.sendEmail`, `announcement.audience`
- [ ] accepts an announcement with `sendEmail: false` → saved (false is a value)
- [ ] refuses an announcement for one customer without a customer → key `announcement.audienceUserId`
- [ ] refuses an unknown status → `status: "stuck"` is refused with key `status`
- [ ] keeps the cron index → `await NotificationJobModel.init()`; `collection.indexes()` has an index with `key { status: 1, createdAt: 1 }`

`notification.model.test.ts`
- [ ] refuses a second notification with the same job and user → `await NotificationModel.init()`; the second `create` rejects with `code 11000`; 1 row
- [ ] allows the same job for two different users → 2 rows
- [ ] allows many notifications without a job → two rows with `jobId null` for the same user are saved (partial index)
- [ ] saves defaults → `readAt null`, `link null`, `jobId null`
- [ ] refuses a title of 1 and of 121 characters and a body of 1 and of 1001 characters → `ValidationError`, keys `title` / `body`
- [ ] refuses a link that is not an internal path → `"//evil.com"`, `"account"` and a 301-character path are refused (key `link`); `"/account/themes"` is saved
- [ ] refuses an unknown type → key `type`
- [ ] deletes rows after one year → `collection.indexes()` has `key { createdAt: 1 }` with `expireAfterSeconds 31536000`; and the unique index on `{ jobId: 1, userId: 1 }` has `partialFilterExpression { jobId: { $type: "objectId" } }`

`notification.texts.test.ts`
- [ ] buildOwnedThemeUpdatedText › builds title and link → `{ themeName: "Aurora Blog", version: "1.4.0" }` gives title `"Aurora Blog 1.4.0 is available"`, link `"/account/themes"`
- [ ] buildFavoriteThemeUpdatedText › builds title and link → title `"Aurora Blog 1.4.0 is out"`, link `"/themes/aurora-blog"`
- [ ] update notifications › body with one change is that change → `changeTexts ["Fixed the footer"]` gives body `"Fixed the footer"`
- [ ] update notifications › body with more changes → `[PLANNER: same decision as "Body of update notifications"]`
- [ ] buildCategoryNewThemeText › builds title, body and link → title `"New in Blog: Aurora Blog"`, body = the tagline, link `"/themes/aurora-blog"`
- [ ] buildAnnouncementText › keeps title and body and gives link null without a link; keeps the link when given
- [ ] buildWalletPaymentApprovedText › says the amount → `amountEgp 1465` gives title `"Payment approved: Aurora Blog"`, body `"Your payment of 1,465 EGP was confirmed. You can download the theme now."`, link `"/account/themes"`
- [ ] buildWalletPaymentRejectedText › links to the payment → title `"Payment not confirmed: Aurora Blog"`, body `"Reason: The amount was wrong."`, link `"/account/wallet-payments/<id>"`
- [ ] buildFeedbackReplyText › title is fixed and body is the subject → title `"Reply to your feedback"`, body = subject, link `"/account/feedback"`
- [ ] cutting › cuts a title over 120 characters and ends it with … → announcement title of 130 `"a"` gives a title of length 120 that equals 119 `"a"` plus `"…"`
- [ ] cutting › keeps a title of exactly 120 characters → unchanged
- [ ] cutting › cuts a body over 1 000 characters → length 1000, ends with `"…"`

Break check (≥ 3): remove the `partialFilterExpression` of the `{ jobId, userId }` index; make `createAnnouncementJob` always use stage
`"all_customers"`; remove the `cutText` call for titles; remove the `versionId` rule from the `pre("validate")` hook.

## Do NOT

- Do not add any field or index that is not in 03 §12 and §13. Do not change `user.model.ts` or any existing feature.
- Do not write processing code, emails, pages, actions or routes. Do not write `JOB_BATCH_SIZE` and the other processor constants.
- The job functions never call `activityService.log`.
- `notification-job.service.ts` and the repository must not import `next/*`.
- No `any`, no `@ts-ignore`, no `eslint-disable`. Do not change the existing tests.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-007: notifications core`
