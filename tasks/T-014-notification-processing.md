# T-014: Notification processing (cron), notification emails, notification center

- Depends on: T-001 – T-013
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2, 5, 7, 9, 10; `docs/03-data-model.md` sections 11, 12, 13;
  `docs/09-emails.md` **all sections** (1, 2, 3 #7 – #10, 4, 5, 7); `docs/05-pages.md` section 4 (`/account/notifications`, shell menu);
  `docs/00-product.md` section 3.7; `docs/10-testing.md` sections 2, 4, 8 (flow 4); `docs/01-decisions.md` D-111, D-116 – D-119.
  Pattern to copy: T-012 (service tests, handler test), `src/features/themes/*`.

## Goal

T-007 created the job **documents** (`createVersionReleasedJob`, `createThemePublishedJob`, `createAnnouncementJob`), the notification model and the texts.
This task **processes** them:

1. The cron route `POST /api/cron/process-notifications` and `processNotificationJobs()`: audience in batches of 100, in-app notifications, bulk emails, retries, locks (09 §5).
2. The notification emails #7 – #10 (builders and templates).
3. The customer notification center: the page, the header bell, the unread badge in the account menu.

**Not in this task**: favorites and follows buttons / pages (T-015: this task creates only the read side of the `favorites` collection that the fan-out needs),
the admin announcement form and the admin "Retry" button (T-017). Creating jobs is T-007 / T-008 / T-010 / T-017.

## Contract: functions of earlier tasks that this task calls

Use these names. If the merged code spells one differently, use the real name and do **not** rename it. Ids are strings.

| Name | File | From |
|---|---|---|
| `NotificationJobModel`, `NotificationJobRecord`, `NotificationModel`, the job `stage` / `kind` / `status` enums (constants), `lockedUntil` field | `features/notifications/notification-job.model.ts`, `notification.model.ts`, `notification.constants.ts` | T-007 |
| `buildOwnedThemeUpdatedText({ themeName, version, changeTexts })`, `buildFavoriteThemeUpdatedText({ themeName, themeSlug, version, changeTexts })`, `buildCategoryNewThemeText({ categoryName, themeName, themeSlug, tagline })`, `buildAnnouncementText({ title, body, link })` — each returns `NotificationText` = `{ title, body, link }` (09 §4); `changeTexts` = the `text` of every change in order | `features/notifications/notification.texts.ts` | T-007 |
| `notification.repository.ts` and `notification.service.ts` with `createNotification` (this task extends both files) | `features/notifications/` | T-013 |
| `createVersionReleasedJob`, `createThemePublishedJob`, `createAnnouncementJob` (tests may use them) | `features/notifications/notification-job.service.ts` | T-007 |
| `isAdminEmail(email)` | `features/users/user.service.ts` | T-003 |
| `OwnershipModel`, `createOwnership` factory | `features/ownerships/…` | T-009 |
| `EmailRateLimitError`, `EmailSender`, `FakeEmailSender` (`sent`, `failNext`) | `features/emails/email.types.ts`, `shared/test/fakes/fake-email-sender.ts` | T-003 |
| `getEmailSender()` | `features/emails/email.sender.ts` | T-003 |
| `getCategoryById(id)` | `features/categories/category.service.ts` | T-004 |
| `listVersionsForTheme` / version model `VersionModel` | `features/versions/…` | T-008 |
| `isDuplicateKeyError` | `shared/db/duplicate-key.ts` | T-011 |
| `AccountShell({ isAdmin, children })`, `AccountNav` (`"use client"`, `usePathname`, the menu links of 05 §4) and `app/account/layout.tsx` (`getCurrentUser()` then `<AccountShell isAdmin={user?.isAdmin === true}>`) | `shared/layout/AccountShell.tsx`, `AccountNav.tsx`, `app/account/layout.tsx` | T-009 |
| `now()`, `setTestNow` | `shared/lib/clock.ts` | T-001 |

## Packages

None.

## Env variable added (update `src/shared/config/env.ts`, `.env.example`, `vitest.config.ts` `test.env`, `.github/workflows/ci.yml` `env:`)

| Name | Rule | Value in `.env.example`, vitest and ci |
|---|---|---|
| `CRON_SECRET` | `z.string().min(32)` | `dev-cron-secret-change-me-dev-cron-secret` |

Comment line above it in `.env.example`: `# Secret the server cron sends as "Authorization: Bearer <secret>" (32+ random characters)`.
The e2e run reads `CRON_SECRET` from `.env` (or the ci env): a developer's local `.env` needs the new line too.

## Files

```
src/shared/config/env.ts / .env.example / vitest.config.ts / .github/workflows/ci.yml     (change) CRON_SECRET
src/shared/layout/AccountShell.tsx / AccountNav.tsx          (change) unread badge on the Notifications link
src/app/account/layout.tsx                                  (change) passes the unread count
src/app/layout.tsx                                          (change) the bell in the header
src/shared/test/factories.ts                                (change) createFavorite, createNotificationJob, createOwnersForTheme

src/features/notifications/
  notification.constants.ts            (change) add JOB_BATCH_SIZE, MAX_BATCHES_PER_RUN, JOB_LOCK_SECONDS, MAX_JOB_ATTEMPTS, NOTIFICATIONS_PER_PAGE, JOB_STAGES_BY_KIND (T-007 has only the enum lists)
  notification.types.ts                (change) NotificationDTO, NotificationPageDTO
  notification.mapper.ts               (change or new) toNotificationDTO
  notification.repository.ts           (change) created by T-013; add the queries below
  notification.service.ts              (change) created by T-013; add the center functions + findNotifiedUserIds, insertNotificationsForJob
  notification-job.repository.ts       (change) claim / progress / failure writes below
  notification-audience.service.ts     new: read audience rows, select recipients (steps 1, 3, 4, email switch)
  notification-message.service.ts      new: build the emails and the notifications of one batch (steps 5, 7)
  notification-job.processor.ts        new: processNotificationJobs, processOneBatch
  notification-cron.handler.ts         new: handleNotificationCron
  notification.actions.ts              new: openNotificationAction, markAllNotificationsReadAction
  notification-job.processor.test.ts / notification-cron.handler.test.ts / notification.service.test.ts / notification.mapper.test.ts
  components/NotificationBell.tsx, components/NotificationList.tsx

src/features/favorites/                 (read side only; T-015 completes the feature in these same files)
  favorite.model.ts / favorite.repository.ts / favorite.service.ts / favorite.constants.ts / favorite.service.test.ts

src/features/ownerships/ownership.repository.ts / ownership.service.ts / ownership.service.test.ts   (change) listActiveOwnerRowsAfter
src/features/users/user.repository.ts / user.service.ts / user.types.ts / user.service.test.ts       (change) getUsersForNotification, listCustomerRowsAfter
src/features/themes/theme.repository.ts / theme.service.ts / theme.service.test.ts                   (change) getThemeForNotification
src/features/versions/version.repository.ts / version.service.ts / version.service.test.ts           (change) getVersionForNotification

src/features/emails/email.format.ts / email.format.test.ts   formatChangeLines
src/features/emails/templates/EmailLayout.tsx               (change) optional `reason` prop
src/features/emails/templates/ThemeUpdateEmail.tsx, NewThemeInCategoryEmail.tsx, AnnouncementEmail.tsx
src/features/emails/email.service.ts / email.service.test.ts   (change) four build functions + tests

src/app/api/cron/process-notifications/route.ts
src/app/account/notifications/page.tsx
e2e/notifications.spec.ts
```

## Favorites: the read side (03 §11)

`favorite.model.ts`: every field and both indexes of 03 §11 (`{ userId, targetType, targetId }` unique; `{ targetType, targetId, _id }`), collection `favorites`, `targetType` enum `theme | category` (`FAVORITE_TARGET_TYPES` in `favorite.constants.ts`), `FavoriteRecord` via `InferSchemaType`.
`favorite.repository.ts`: `findFavoriteRowsAfter({ targetType, targetId, afterId, limit })` — rows `{ _id, userId }` with `_id > afterId` (all rows when `afterId` is `null`), sorted by `_id` ascending, `.lean()`.
`favorite.service.ts`: `listFavoriteRowsAfter({ targetType, targetId, afterId, limit }): Promise<{ rowId: string; userId: string }[]>`.
Nothing else (no add / remove / list: T-015).

## Fan-out sources of the other features

| Service function | Rules |
|---|---|
| `ownershipService.listActiveOwnerRowsAfter({ themeId, afterId, limit }): Promise<{ rowId: string; userId: string }[]>` | Ownerships with `{ themeId, status: "active" }`, `_id > afterId` (all when `null`), `_id` ascending (index `{ themeId, status, _id }`); `rowId` = the ownership `_id`. |
| `userService.listCustomerRowsAfter({ afterId, limit }): Promise<{ rowId: string; userId: string }[]>` | Users with `disabled: false`, `_id > afterId`, `_id` ascending; `rowId` = `userId` = the user `_id`. |
| `userService.getUsersForNotification(userIds): Promise<NotificationUserDTO[]>` | `NotificationUserDTO = { id, name, email, disabled, emailOwnedThemeUpdates, emailFavoriteThemeUpdates, emailFollowedCategoryThemes, emailAnnouncements }` (user.types.ts). Unknown ids are skipped. Invalid ids are dropped. |
| `themeService.getThemeForNotification(themeId): Promise<{ id; name; slug; tagline; categoryId } \| null>` | any status; `null` for an invalid or unknown id |
| `versionService.getVersionForNotification(versionId): Promise<{ version: string; releasedAt: Date; changes: { type: ChangeType; text: string }[] } \| null>` | `null` for an invalid or unknown id |

## Notification job repository and service (`notification-job.repository.ts`)

Functions (each starts with `connectDB()`):

| Function | Does |
|---|---|
| `claimNextJob(): Promise<NotificationJobRecord \| null>` | One atomic `findOneAndUpdate` (09 §5.3): filter `{ status: { $in: ["pending", "running"] }, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now() } }] }`, sort `{ createdAt: 1 }`, update `$set: { status: "running", lockedUntil: now() + JOB_LOCK_SECONDS seconds }`, `returnDocument: "after"`. When the returned job has `startedAt === null`: a second `updateOne` sets `startedAt = now()` and the returned record is updated the same way. |
| `saveBatchProgress(jobId, { cursor, notifiedDelta, emailedDelta })` | `$set: { cursor, lockedUntil: null }`, `$inc: { notifiedCount, emailedCount }` |
| `moveJobToStage(jobId, stage)` | `$set: { stage, cursor: null, lockedUntil: null }` |
| `markJobDone(jobId)` | `$set: { status: "done", finishedAt: now(), lockedUntil: null }` |
| `releaseJobLock(jobId)` | `$set: { lockedUntil: null }` |
| `recordJobFailure(jobId, message)` | `findOneAndUpdate` with `$inc: { attempts: 1 }` and `$set: { error: message.slice(0, 500), lockedUntil: null }`, `returnDocument: "after"`; when the new `attempts` is `>= MAX_JOB_ATTEMPTS` a second `updateOne` sets `status: "failed"`, `finishedAt: now()`. |

Constants (`notification.constants.ts`): `JOB_BATCH_SIZE = 100`, `MAX_BATCHES_PER_RUN = 10`, `JOB_LOCK_SECONDS = 120`, `MAX_JOB_ATTEMPTS = 5`, `NOTIFICATIONS_PER_PAGE = 20`.
`JOB_STAGES_BY_KIND` (03 §13): `version_released: ["theme_owners", "theme_favoriters"]`, `theme_published: ["category_followers"]`; an announcement has the single stage given by its `announcement.audience` (`all_customers`, `theme_owners` or `one_customer`).

## Audience (`notification-audience.service.ts`) — 09 §5.4 steps 1, 3, 4

```ts
export type AudienceRow = { rowId: string; userId: string };
export type Recipient = { userId: string; name: string; email: string; wantsEmail: boolean };
// Step 1: the next JOB_BATCH_SIZE source rows after job.cursor for the job's current stage.
export async function readAudienceRows(job: NotificationJobRecord): Promise<AudienceRow[]>
// Steps 3 and 4 and the email switch: who really gets a notification in this batch.
export async function selectRecipients(job: NotificationJobRecord, rows: AudienceRow[]): Promise<Recipient[]>
```

`readAudienceRows` by stage (`job.cursor` is the `afterId`, `null` = from the start, `limit = JOB_BATCH_SIZE`):
`theme_owners` → `listActiveOwnerRowsAfter` with `job.themeId` (for an announcement with audience `theme_owners`: `announcement.audienceThemeId`); `theme_favoriters` → `listFavoriteRowsAfter({ targetType: "theme", targetId: themeId })`;
`category_followers` → `listFavoriteRowsAfter({ targetType: "category", targetId: categoryId })`; `all_customers` → `listCustomerRowsAfter`;
`one_customer` → when `cursor` is `null`: `[{ rowId: audienceUserId, userId: audienceUserId }]`, otherwise `[]`.

`selectRecipients`:
1. `getUsersForNotification(rows.map(userId))`. Drop `disabled` users. Drop admins (`isAdminEmail(email)`).
2. Drop users that already have a notification for this job (`notificationService.findNotifiedUserIds(job._id, userIds)`): they were reached in an earlier stage or in an earlier try of this batch.
3. `wantsEmail` (09 §3, 03 §13): `version_released` + `theme_owners` → `emailOwnedThemeUpdates`; `version_released` + `theme_favoriters` → `emailFavoriteThemeUpdates`; `theme_published` → `emailFollowedCategoryThemes`; `announcement` → `announcement.sendEmail === true` **and** `emailAnnouncements`.

## Messages (`notification-message.service.ts`) — 09 §3, §4, §5.4 steps 5 and 7

```ts
export type NewNotification = { userId: string; type: NotificationType; title: string; body: string; link: string | null; jobId: string };
export type BatchMessages = { emails: EmailMessage[]; notifications: NewNotification[] };
export async function buildBatchMessages(job: NotificationJobRecord, recipients: Recipient[]): Promise<BatchMessages>
```
Loads the context **once** per batch: for `version_released`: `getThemeForNotification(job.themeId)` and `getVersionForNotification(job.versionId)`; for `theme_published`: the theme and `getCategoryById(theme.categoryId).name`; for `announcement`: the job's `announcement` fields. A missing theme, version or category → `throw new Error("Notification job data is missing.")` (counts as a failed attempt).
One `NewNotification` per recipient with the texts of `notification.texts.ts`: stage `theme_owners` of `version_released` → type `owned_theme_updated`; `theme_favoriters` → `favorite_theme_updated`; `theme_published` → `category_new_theme`; `announcement` → `announcement`. One email per recipient with `wantsEmail`:
`buildThemeUpdateEmail` (owners), `buildFavoriteUpdateEmail` (favoriters), `buildNewThemeInCategoryEmail`, `buildAnnouncementEmail`.

## The processor (`notification-job.processor.ts`) — 09 §5.2, §5.4

```ts
export type ProcessRunResult = { processedBatches: number; finishedJobs: number };
// The cron work: up to MAX_BATCHES_PER_RUN batches of the oldest open jobs.
export async function processNotificationJobs(): Promise<ProcessRunResult>
export type BatchResult = { result: "ok" | "rate_limited" | "failed"; isFinished: boolean };
// One batch of one claimed job (steps 1 – 8).
export async function processOneBatch(job: NotificationJobRecord): Promise<BatchResult>
```

`processNotificationJobs`: `processedBatches = 0`, `finishedJobs = 0`; `while (processedBatches < MAX_BATCHES_PER_RUN)`: `job = await claimNextJob()` (none → stop); `{ result, isFinished } = await processOneBatch(job)`; `processedBatches += 1`; `isFinished` → `finishedJobs += 1`; `result === "rate_limited"` → stop the run; `result === "failed"` → stop the run. Return both numbers.
`[PLANNER: 09 §5.2 stops the run only for a rate limit. After another failure the same job would be retried at once, in the same run, and its 5 attempts would be used up within seconds if the provider is down. 09 §5.4 says the batch "is tried again on the next run". Recommended: a failed batch also stops the run (retry on the next cron minute). Confirm; the tests below assume it.]`

`processOneBatch(job)` — a `try/catch` around steps 1 – 8:

| # | Step |
|---|---|
| 1 | `rows = await readAudienceRows(job)` |
| 2 | `rows` empty: when the kind has a next stage (`JOB_STAGES_BY_KIND`): `moveJobToStage(job._id, nextStage)`; otherwise `markJobDone(job._id)` and `isFinished: true`. Return `{ result: "ok", isFinished }`. |
| 3 – 5 | `recipients = await selectRecipients(job, rows)`; `{ emails, notifications } = await buildBatchMessages(job, recipients)` |
| 6 | `emails.length > 0` → `getEmailSender().sendBatch(emails, "job-" + job._id + "-" + job.stage + "-" + rows[0].rowId)` (the key is the same for a retry of the same batch) |
| 7 | `inserted = await notificationService.insertNotificationsForJob(notifications)` (below) |
| 8 | `saveBatchProgress(job._id, { cursor: <the last row's rowId as ObjectId>, notifiedDelta: inserted, emailedDelta: emails.length })`. Return `{ result: "ok", isFinished: false }`. |

Errors:
- `EmailRateLimitError` → `releaseJobLock(job._id)`, return `{ result: "rate_limited", isFinished: false }`. This is **not** an attempt.
- any other error → `recordJobFailure(job._id, error.message)` (at the 5th attempt the job becomes `failed`, see the repository), `console.error("notification batch failed", job._id.toString())` (the id only: no error body, no emails), return `{ result: "failed", isFinished: false }`. The cursor does not move.

`notificationService.insertNotificationsForJob(notifications): Promise<number>`: `NotificationModel.insertMany(docs, { ordered: false })` in a `try/catch` that ignores a duplicate-key error (`isDuplicateKeyError`; the unique `{ jobId, userId }` index) and rethrows anything else; returns the **number of notifications that now exist** for this `jobId` and these `userId`s (`countDocuments`), which is the inserted count because step 4 removed everyone who already had one. An empty list returns `0` without a query.
`notificationService.findNotifiedUserIds(jobId, userIds): Promise<Set<string>>`: the `userId`s that already have a notification with this `jobId`.

## Cron handler and route — 09 §5.1

```ts
export async function handleNotificationCron(request: Request): Promise<Response>
```
1. `Authorization` header must equal `"Bearer " + env.CRON_SECRET`. Compare the two as `Buffer`s with `timingSafeEqual` **after** checking that the lengths are equal (different lengths → not equal). Wrong or missing → `new Response(null, { status: 401 })`; nothing runs.
2. `Response.json({ processedBatches, finishedJobs }, { status: 200 })` from `processNotificationJobs()`.
3. A thrown error → `console.error("notification cron failed", err)` and `new Response(null, { status: 500 })`.

`src/app/api/cron/process-notifications/route.ts`: `export async function POST(request: Request) { return handleNotificationCron(request); }` — nothing else.

## Emails #7 – #10 — 09 §3

`email.format.ts`: `formatChangeLines(changes: { type: ChangeType; text: string }[]): string[]` — one line per change `"<Label>: <text>"` with the labels `New`, `Improved`, `Fixed`, `Removed`; at most 10 lines; with more changes the 11th line is `…and <n> more changes.` where `n = changes.length - 10`.
`EmailLayout.tsx`: new optional prop `reason?: string`. When set it renders, below the "Questions?" line, `Text`: `You get this email because <reason>. Change your email settings: <env.APP_URL>/account/settings`. Existing templates do not pass it, so they do not change.
Build functions in `email.service.ts` (each renders with `renderEmail` and returns `Promise<EmailMessage>`; none of them sends):

| Function (input) | Subject | Template and content | `reason` |
|---|---|---|---|
| `buildThemeUpdateEmail({ to, name, themeName, version, releasedAt, changes })` — #7 | `<Theme> <version> is available` | `ThemeUpdateEmail`: `Hi <Name>,` / `A new version of **<Theme>** is ready: **<version>** (<formatDate(releasedAt)>).` / `What changed:` + the `formatChangeLines` lines / button `Download the update` → `/account/themes` | `you own <Theme>` |
| `buildFavoriteUpdateEmail({ to, name, themeName, themeSlug, version, changes })` — #8 | `<Theme> <version> is out` | `ThemeUpdateEmail` (same template, `variant: "favorite"`): `Hi <Name>,` / `**<Theme>**, a theme you favorited, has a new version: **<version>**.` / `What changed:` + lines / button `See the theme` → `/themes/<slug>` | `you favorited <Theme>` |
| `buildNewThemeInCategoryEmail({ to, name, categoryName, themeName, themeSlug, tagline })` — #9 | `New in <Category>: <Theme>` | `NewThemeInCategoryEmail`: `Hi <Name>,` / `A new theme was just added to **<Category>**: **<Theme>**: <tagline>` / button `See the theme` → `/themes/<slug>` | `you follow <Category>` |
| `buildAnnouncementEmail({ to, name, title, body, link })` — #10 | the announcement `title` | `AnnouncementEmail`: `Hi <Name>,` / the body (plain text, line breaks kept: one paragraph per line) / only when `link` is set: button `Learn more` → `env.APP_URL + link` | `you are a customer of Theme Store` |

`templateName` = the component name. All button links are `env.APP_URL + path`. No email contains `/api/downloads/`.

## Notification center

Service (`notification.service.ts`) and repository (`notification.repository.ts`):

| Function | Rules |
|---|---|
| `listNotifications(userId, page): Promise<NotificationPageDTO>` | Only this user's, newest first (`createdAt` desc, `_id` desc), 20 per page. `NotificationPageDTO = { items: NotificationDTO[]; page; totalPages; total; unreadCount }`. `NotificationDTO = { id, type, title, body, link: string \| null, isRead: boolean, createdAt: Date }`. |
| `countUnreadNotifications(userId): Promise<number>` | `readAt: null` for this user (index `{ userId, readAt }`) |
| `openNotification(userId, notificationId): Promise<{ link: string \| null } \| null>` | `null` for an invalid id, an unknown id or **another user's** notification (nothing is changed). Otherwise sets `readAt = now()` when it is `null` (an already read one keeps its date) and returns its `link`. |
| `markAllNotificationsRead(userId): Promise<number>` | sets `readAt = now()` on this user's unread notifications only; returns how many |

Actions (`notification.actions.ts`, plain form actions like `logoutAction`: `(formData: FormData): Promise<void>`):
- `openNotificationAction`: `requireUser("/account/notifications")`; `id = readText(formData, "id")`; `openNotification(user.id, id)`; `revalidatePath("/account/notifications")`; a result with a `link` → `redirect(link)`; otherwise return.
- `markAllNotificationsReadAction`: `requireUser`; `markAllNotificationsRead(user.id)`; `revalidatePath("/account/notifications")`.

Page `/account/notifications?page=` (metadata `Notifications · Theme Store`, `robots: { index: false }`; `requireUser("/account/notifications")`; `?page` parsed like `/admin/themes` with `z.coerce.number().int().min(1).catch(1)`; rendered inside the same account shell as `/account/themes`):
Heading 1 `Notifications`; when `unreadCount > 0` a form with `markAllNotificationsReadAction` and `SubmitButton variant="secondary"` `Mark all as read` / `Marking…`; `NotificationList`; `Pagination`. Empty: `Text` `No notifications yet.`
`NotificationList` (props `items`): one `Card` per item with `Stack`: a form `action={openNotificationAction}` with hidden `id` and `Button type="submit" variant="ghost"` whose label is the title; `Badge tone="primary"` `New` when unread; `Text` body; `Text size="sm" tone="muted"` `formatDate(createdAt)`.
`NotificationBell` (props `unreadCount`): `Inline gap="xs"`: `TextLink` `Notifications` → `/account/notifications`, and `Badge tone="primary"` with the count when it is greater than 0.
`src/app/layout.tsx`: when `getCurrentUser()` returns a user, call `countUnreadNotifications(user.id)` and render `<NotificationBell unreadCount={…} />` next to `AccountMenu` in the header's `accountSlot` (inside an `Inline`); logged-out visitors see no bell.
`AccountShell.tsx` gets a new optional prop `unreadNotificationCount?: number` and passes it to `AccountNav.tsx` (same new optional prop); the menu link `Notifications` shows `<Badge tone="primary">{count}</Badge>` after the label when it is greater than 0. `app/account/layout.tsx`: when `getCurrentUser()` returns a user, pass `unreadNotificationCount={await countUnreadNotifications(user.id)}`; for no user pass `0` (pages guard themselves).
`[PLANNER: the docs do not give the texts of the bell and the page buttons ("Notifications", "Mark all as read" and "No notifications yet." are in 05 §4); the label "New" is in 05 §4. Confirm "Marking…".]`

## Test factories

- `createFavorite(userId: string, targetType: FavoriteTargetType, targetId: string)` → inserts one `favorites` row and returns the record (the signature T-015 expects).
- `createOwnersForTheme(themeId, count): Promise<UserRecord[]>` — creates `count` verified users with `UserModel.insertMany` and an `active` ownership each with `OwnershipModel.insertMany` (`source "purchase"`, `orderId` = a new ObjectId) — fast enough for 250 users.
- `createNotificationJob(overrides?)`: `kind` default `"version_released"`. Defaults for every kind: `status "pending"`, `cursor null`, `notifiedCount 0`, `emailedCount 0`, `attempts 0`, `error null`, `startedAt null`, `finishedAt null`, `lockedUntil null`, `createdByUserId` = `(await createUser())._id`. `version_released`: creates a published theme and a version (`createVersion`) when `themeId` / `versionId` are missing, `stage "theme_owners"`. `theme_published`: creates a theme (and its category) when missing, `categoryId` = the theme's category, `stage "category_followers"`. `announcement`: `announcement` default `{ title: "Big sale", body: "Everything is cheaper this week.", link: null, sendEmail: true, audience: "all_customers", audienceThemeId: null, audienceUserId: null }`, `stage` = its audience, `themeId`, `versionId`, `categoryId` `null`. Written with `NotificationJobModel.create` (so the model's rules apply).

## Required tests

Common: `setTestNow(new Date("2026-11-01T10:00:00Z"))`; theme "Aurora Blog", version `1.1.0` with changes `[{ type: "fixed", text: "Fixed the footer" }]`; users from `createUser()`; `fakeEmailSender` reset by the global setup.

`notification-job.processor.test.ts` (real in-memory MongoDB, `FakeEmailSender`)
- [ ] processNotificationJobs › notifies active owners, then favoriters; a user who is both gets one notification (`owned_theme_updated`) and one email → owners A (also favoriter) and B, favoriter C: 3 notifications (A `owned_theme_updated`, B `owned_theme_updated`, C `favorite_theme_updated`, title `"Aurora Blog 1.1.0 is available"` / `"Aurora Blog 1.1.0 is out"`, `link` `/account/themes` / `/themes/<slug>`, `jobId` = the job), 3 emails, job `done` with `finishedAt` now, `notifiedCount 3`, `emailedCount 3`; the result is `{ processedBatches: 4, finishedJobs: 1 }`
- [ ] processNotificationJobs › skips revoked owners, disabled users and admins (`createAdmin()` owner) → only the one normal owner is notified and emailed
- [ ] processNotificationJobs › sends emails only to users with the matching switch on and still creates in-app notifications for the others (`emailOwnedThemeUpdates: false` on one owner: 2 notifications, 1 email)
- [ ] processNotificationJobs › a favoriter with `emailFavoriteThemeUpdates: false` gets the notification but no email
- [ ] processNotificationJobs › theme published: category followers get `category_new_theme` with title `"New in <Category>: Aurora Blog"` and an email with the same subject; the switch `emailFollowedCategoryThemes: false` removes only the email
- [ ] processNotificationJobs › announcement with `sendEmail: false` creates the notifications (type `announcement`, title and body of the job, link) and sends 0 emails; with `sendEmail: true` only users with `emailAnnouncements` get an email
- [ ] processNotificationJobs › announcement for `theme_owners` reaches only the active owners of that theme (not other users, not favoriters, not revoked owners)
- [ ] processNotificationJobs › announcement for `all_customers` reaches every enabled non-admin user; for `one_customer` only that user
- [ ] processNotificationJobs › processes 250 owners in 3 data batches → `notifiedCount 250`, `emailedCount 250`, job `done` with `finishedAt`; the 250 emails use exactly 3 different idempotency keys; result `{ processedBatches: 5, finishedJobs: 1 }` (3 data batches, 1 empty owners batch that moves the stage, 1 empty favoriters batch that finishes)
- [ ] processNotificationJobs › does not notify a user twice for one job: a user who already has a notification for the job (created before the run) gets neither a second notification nor an email
- [ ] processNotificationJobs › a job locked by another run (`lockedUntil` 60 s in the future) is not picked (result `{ processedBatches: 0, finishedJobs: 0 }`); after `setTestNow` to just after the lock it is picked and finished
- [ ] processNotificationJobs › an email failure leaves the cursor unchanged, adds 1 to `attempts`, stores the message in `error`, releases the lock and writes 0 notifications; the run stops after that batch (`processedBatches 1`)
- [ ] processNotificationJobs › after 5 failed runs the job is `failed` with `finishedAt` now and `attempts 5`; a 6th run picks nothing
- [ ] processNotificationJobs › `EmailRateLimitError` stops the run without adding to `attempts`; the lock is released, no notification is written, and the next run finishes the job
- [ ] processNotificationJobs › the retry of a failed batch uses the same idempotency key: after one failure and a second run, the first email of the owners stage has the key `"job-<jobId>-theme_owners-<id of the first ownership>"`
- [ ] processNotificationJobs › claims the oldest open job first (two pending jobs with different `createdAt`)

`notification-cron.handler.test.ts` (build requests with `new Request("http://localhost:3000/api/cron/process-notifications", { method: "POST", headers })`)
- [ ] handleNotificationCron › refuses a missing, a wrong and a wrong-length secret → status 401, empty body; the pending job is unchanged
- [ ] handleNotificationCron › the correct secret (`Bearer ` + `process.env.CRON_SECRET`) → 200 and JSON `{ processedBatches, finishedJobs }` with the real numbers (one job with one owner: `{ processedBatches: 3, finishedJobs: 1 }`); the job is `done`

`notification.service.test.ts`
- [ ] listNotifications › returns only the user's notifications, newest first, with `isRead` and `unreadCount`
- [ ] listNotifications › 25 notifications: page 1 has 20, page 2 has 5, `totalPages 2`
- [ ] countUnreadNotifications › counts only this user's unread ones
- [ ] openNotification › sets `readAt` to now and returns the link; a second call keeps the first `readAt`; a notification without link returns `{ link: null }`
- [ ] openNotification › another user's notification and an invalid id return `null` and change nothing
- [ ] markAllNotificationsRead › marks only the user's unread notifications and returns the count; other users' stay unread
- [ ] insertNotificationsForJob › returns the number inserted; a repeated insert of the same users inserts nothing new and does not throw

`notification.mapper.test.ts`: `toNotificationDTO` maps `readAt: null` to `isRead false`, a date to `true`, and keeps `link: null`.

`email.service.test.ts` (added) and `email.format.test.ts`
- [ ] buildThemeUpdateEmail › subject `"Aurora Blog 1.1.0 is available"`; shows the version, the date, `Fixed: Fixed the footer`, the link `http://localhost:3000/account/themes`, the reason `you own Aurora Blog` and the settings link `http://localhost:3000/account/settings`
- [ ] buildThemeUpdateEmail › lists at most 10 changes, then `…and 2 more changes.` for 12 changes (`formatChangeLines` test with 10, 11 → `…and 1 more changes.`, 12)
- [ ] buildFavoriteUpdateEmail › subject `"Aurora Blog 1.1.0 is out"`, link `http://localhost:3000/themes/<slug>`, reason `you favorited Aurora Blog`
- [ ] buildNewThemeInCategoryEmail › subject `"New in Blog: Aurora Blog"`, contains the tagline and the settings link
- [ ] buildAnnouncementEmail › subject = the title; keeps the two lines of a two-line body; with a link the button points to `http://localhost:3000<link>`, without a link there is no `Learn more` button
- [ ] the four builders › the optional emails contain the settings link; the payment emails (`sendOrderConfirmationEmail`, `sendWalletApprovedEmail`, `sendWalletRejectedEmail`, `sendAdminWalletReviewEmail`) contain no `/account/settings`; no email contains `/api/downloads/`

Fan-out reads (added to the service tests of their features)
- [ ] listActiveOwnerRowsAfter › returns only active owners of the theme, `_id` ascending, after the cursor, at most `limit`
- [ ] listFavoriteRowsAfter › filters by target type and id, `_id` ascending, after the cursor
- [ ] listCustomerRowsAfter › skips disabled users, `_id` ascending, after the cursor
- [ ] getUsersForNotification › returns the four switches and `disabled`; skips unknown and invalid ids
- [ ] getThemeForNotification / getVersionForNotification › return the data; `null` for unknown and invalid ids

## E2E (`e2e/notifications.spec.ts`; helpers from `e2e/helpers.ts`: `readMongoUri`, `registerAs(page, email)`)

`beforeAll`: connect mongoose; seed a category, a published theme and a version (`VersionModel.create` with a dummy file key `theme-zips/e2e-<RUN_ID>/dummy.zip`, `sha256` = 64 zeros, `size 1`); `afterAll`: delete the seeded rows, the notifications and jobs. Flow 4 of `10-testing.md` §8, without the upload form (covered by T-008): the version and job are seeded.
- [ ] the owner is notified after the cron runs: customer A `registerAs` and customer B `registerAs` (second context); look up A's id in the `user` collection; seed an active ownership for A (`source "admin_grant"`, `grantedByUserId` = A's id) and a pending `NotificationJobModel` of kind `version_released` for the theme and version (`stage "theme_owners"`); call the cron with `request.post("/api/cron/process-notifications", { headers: { Authorization: "Bearer " + process.env.CRON_SECRET } })` inside `expect.poll` until A has 1 notification (other open jobs of other specs may be processed first); A opens `/account/notifications` → sees `<seeded theme name> 1.1.0 is available`, the header bell link shows `1` (`page.getByRole("banner")`), clicks the title button → URL `/account/themes`; back on `/account/notifications` the badge `New` is gone and the bell shows no count
- [ ] customer B (not an owner) sees `No notifications yet.`
- [ ] the cron route refuses a wrong secret: `request.post(...)` with `Bearer wrong` → status 401

Break check (≥ 3): remove the `userId` filter from `openNotification`; remove step 4 (the already-notified filter); remove the admin filter in `selectRecipients`; compare the cron secret with `startsWith`; do not release the lock after a failure.

## Do NOT

- Do not send emails inside the claim or after writing notifications (09 §5.4: emails **before** notifications). Never log email bodies, recipients, or the cron secret.
- Do not import another feature's repository or model (use their services). Do not add the favorites write side (T-015).
- Do not add fields or indexes that are not in 03 §11 / §12 / §13. No route handler other than the one listed.
- Feature components and pages: layout classes only. No `any`, no `@ts-ignore`, no `eslint-disable`.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-014: notification processing and notification center`
