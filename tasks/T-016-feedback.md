# T-016: Feedback — customers write to the owner, the owner reads, replies and resolves

- Depends on: T-014 (and so T-005 … T-013, all merged into `main`)
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2.3, 5, 9; `docs/03-data-model.md` sections 12 (notifications), 14, 15 (`feedback_sent`);
  `docs/05-pages.md` section 4 (row `/account/feedback`) and section 5 (rows `/admin/feedback`, `/admin/feedback/[id]`, and the AdminShell menu);
  `docs/09-emails.md` sections 1.3, 3 (#11), 3.1 (#11), 4 (`feedback_reply`); `docs/00-product.md` 3.9, 4.9; `docs/01-decisions.md` D-113; `docs/10-testing.md` sections 2, 11 (clock).
  Copy the layer pattern of `src/features/categories/` and the form pattern of `CategoryForm.tsx`.

## Goal

D-113: a logged-in customer sends feedback (subject + message), sees it with its status (Sent, Read, Resolved) and the
owner's reply. The owner reads the inbox, replies (the customer gets an in-app notification **and** an email) and marks
messages resolved. Feedback is the only customer → owner channel (no tickets, no threads: one message, at most one reply).

**Not in this task:** the dashboard number "new feedback messages" (T-018 uses `countNewFeedback` from here); links from the
customer name to `/admin/customers/<id>` (T-017 builds that page); the activity page itself (T-005).

## Files

```
src/features/feedback/
  feedback.model.ts            03 §14
  feedback.repository.ts
  feedback.service.ts
  feedback.mapper.ts
  feedback.schemas.ts
  feedback.types.ts
  feedback.constants.ts
  feedback.actions.ts
  feedback.service.test.ts
  feedback.schemas.test.ts
  feedback.mapper.test.ts
  components/FeedbackForm.tsx                 ("use client") customer form
  components/FeedbackList.tsx                 customer list
  components/admin/FeedbackTable.tsx
  components/admin/FeedbackTabs.tsx           New / Read / Resolved links
  components/admin/ReplyForm.tsx              ("use client")
  components/admin/ResolveButton.tsx          ("use client") "Mark as resolved" / "Reopen"

src/features/users/user.repository.ts        (change) add findUsersByIds(ids: string[]): Promise<UserRecord[]>  (invalid ids are dropped with parseObjectId)
src/features/users/user.service.ts           (change) add getUserSummaries(userIds: string[]): Promise<UserSummaryDTO[]>
src/features/users/user.types.ts             (change) add UserSummaryDTO = { id: string; name: string; email: string }
src/features/users/user.service.test.ts      (change) ONLY add the 1 new test below
src/shared/ui/Text.tsx                       (change) add prop `preserveLines?: boolean` (default false) → adds class `whitespace-pre-wrap` when true
src/shared/layout/AdminShell.tsx             (change) add prop `newFeedbackCount: number`; the "Feedback" link shows a Badge with the number after the label when it is > 0
src/app/admin/layout.tsx                     (change) read `countNewFeedback()` and pass it as `newFeedbackCount`
src/shared/test/factories.ts                 (change) add createFeedback(userId, overrides?)

src/app/account/feedback/page.tsx
src/app/admin/feedback/page.tsx
src/app/admin/feedback/[id]/page.tsx
e2e/feedback.spec.ts
```

`getUserSummaries`: **[PLANNER 16-F]** T-013 (wallet admin list) may already have added a function that returns
`{ id, name, email }` for a list of ids. If a function with the name `getUserSummaries` already exists, reuse it and add nothing;
if a function with another name does the same, stop and write a question in `docs/QUESTIONS.md`.

The account pages get their frame from `src/app/account/layout.tsx` (T-009). Do not wrap the page in `AccountShell` again.
If the layout file does not exist, stop and write a question in `docs/QUESTIONS.md`.

**Notification and activity functions used below (written by T-005, T-007, T-013).** Names are not repeated in the docs:
- `activityService.log(entry, session?)` in `src/features/activity/activity.service.ts` (03 §15 field names: `action`, `actorRole`, `actorUserId`, `subjectUserId`, `targetType`, `targetId`, `summary`). **[PLANNER 16-D]** Planner: confirm the exact name and parameters from T-005.
- The function of `notification.service.ts` that creates **one** notification for **one** user (the one `approveWalletPayment` of T-013 uses for `wallet_payment_approved`), and the title/body/link builder for `feedback_reply` in `notification.texts.ts`. **[PLANNER 16-E]** Planner: write the exact names and parameters here.
- `sendFeedbackReplyEmail({ feedbackId })` in `email.service.ts` (named in 09 §3.1 #11).

## Packages

None.

## Constants (`feedback.constants.ts`)

```ts
export const FEEDBACK_STATUSES = ["new", "read", "resolved"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_SUBJECT_MIN = 3;       // 03 §14
export const FEEDBACK_SUBJECT_MAX = 120;
export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 5000;
export const FEEDBACK_REPLY_MIN = 2;
export const FEEDBACK_REPLY_MAX = 5000;
export const FEEDBACK_LIMIT_PER_DAY = 5;     // 03 §14: at most 5 messages per 24 hours
export const FEEDBACK_LIMIT_WINDOW_HOURS = 24;
export const FEEDBACK_PER_PAGE = 20;         // 02 §7
export const FEEDBACK_CUSTOMER_STATUS_LABELS: Record<FeedbackStatus, string> = { new: "Sent", read: "Read", resolved: "Resolved" };   // 05 §4
export const FEEDBACK_ADMIN_STATUS_LABELS: Record<FeedbackStatus, string> = { new: "New", read: "Read", resolved: "Resolved" };       // 05 §5 tabs
export const FEEDBACK_RATE_LIMIT_MESSAGE = "You have sent a lot of feedback today. Please try again tomorrow.";   // 03 §14, word for word
export const FEEDBACK_SENT_MESSAGE = "Thank you! We read every message.";                                          // 05 §4, word for word
```

## Model (`feedback.model.ts`)

Exactly 03 §14: `userId` (ObjectId → `user`, required), `subject` (3–120, trim), `message` (10–5 000, `trim: true` trims only the ends),
`status` (enum, default `"new"`), `reply` (nullable, 2–5 000, trim), `repliedAt` (nullable Date), `repliedByUserId` (nullable ObjectId).
Collection `feedback`, `{ timestamps: true }`. Indexes exactly `{ status: 1, createdAt: -1 }` and `{ userId: 1, createdAt: -1 }`.
Export `FeedbackModel`, `FeedbackRecord`.

## Repository (`feedback.repository.ts`)

| Function | Does |
|---|---|
| `insertFeedback(userId, subject, message): Promise<FeedbackRecord>` | creates a row (`status` default `"new"`) |
| `countFeedbackSince(userId, since: Date): Promise<number>` | `countDocuments({ userId, createdAt: { $gte: since } })` |
| `findFeedbackById(id): Promise<FeedbackRecord \| null>` | `null` for an invalid id (use `parseObjectId`) |
| `listFeedbackByUser(userId): Promise<FeedbackRecord[]>` | newest first (`createdAt: -1, _id: -1`) |
| `findFeedbackPage(status, page, pageSize): Promise<FeedbackRecord[]>` and `countFeedback(status): Promise<number>` | newest first |
| `markFeedbackReadIfNew(id): Promise<void>` | `updateOne({ _id, status: "new" }, { $set: { status: "read" } })` |
| `setFeedbackReply(id, reply, repliedAt, adminUserId, session?): Promise<FeedbackRecord \| null>` | sets `reply`, `repliedAt`, `repliedByUserId`; returns the updated row; `status` is not changed |
| `setFeedbackStatus(id, status): Promise<FeedbackRecord \| null>` | sets `status`; `null` when missing |
| `countFeedbackByStatus(status): Promise<number>` | for the badge |

## Service (`feedback.service.ts`)

Errors are `AppError`. Use `now()` from `shared/lib/clock` for "now".

| Function | Rules / errors |
|---|---|
| `sendFeedback(userId, input: FeedbackInput): Promise<{ id: string }>` | 1) count the user's rows with `createdAt >= now() − 24 h`; if `>= 5` → `AppError("RATE_LIMITED", FEEDBACK_RATE_LIMIT_MESSAGE)` and nothing is written (the 6th message is refused). 2) insert (`status "new"`, `reply null`). 3) **after** the insert, outside any transaction, `activityService.log({ action: "feedback_sent", actorRole: "customer", actorUserId: userId, subjectUserId: userId, targetType: "feedback", targetId: <new id>, summary })` — summary text: **[PLANNER 16-D]** recommended `"Feedback sent: <subject>"`. |
| `listFeedbackForUser(userId): Promise<FeedbackDTO[]>` | only that user's rows, newest first |
| `listFeedbackForAdmin({ status, page }): Promise<FeedbackAdminPageDTO>` | rows of that status, newest first, 20 per page; customer name and email through `getUserSummaries` (a missing user shows `"—"` for name and email); returns `{ items, page, totalPages, total }` |
| `openFeedbackForAdmin(id): Promise<FeedbackAdminDTO \| null>` | `null` for an unknown or invalid id. A `new` row is set to `read` first (03 §14); `read` and `resolved` rows keep their status. Returns the DTO with the status **after** this call, plus `customer: { id, name, email }`. |
| `replyToFeedback(id, reply, adminUserId): Promise<void>` | unknown id → `AppError("NOT_FOUND", <[PLANNER 16-B]>)`. Already has a reply → **[PLANNER 16-C]**. Else in **one transaction** (`withTransaction`, 02 §7): `setFeedbackReply(...)` and create the `feedback_reply` notification for the customer (09 §4: title `Reply to your feedback`, body = the subject, link `/account/feedback`; the function of 16-E, passing `session`). **After** the transaction: `sendFeedbackReplyEmail({ feedbackId })`; if it throws, `console.error("replyToFeedback email failed")` (never the reply text) and the function still resolves (09 §1.3). The status does not change. No activity log (there is no such action in 03 §15). |
| `resolveFeedback(id): Promise<void>` | unknown id → NOT_FOUND `<[PLANNER 16-B]>`; sets `status "resolved"` from `new` or `read` |
| `reopenFeedback(id): Promise<void>` | unknown id → NOT_FOUND `<[PLANNER 16-B]>`; a `resolved` row becomes `read` (05 §5); any other status is left as it is, no error |
| `countNewFeedback(): Promise<number>` | rows with `status "new"` (used by the admin menu badge and, in T-018, by the dashboard) |

**[PLANNER 16-B]** The NOT_FOUND text for feedback is not in the docs. Recommended: `"Feedback not found."` (same style as `"Category not found."`, `"Theme not found."`).

**[PLANNER 16-C]** What happens when the owner replies to a message that already has a reply is not in the docs (03 §14 has a single `reply` field).
Option A (recommended): refuse with `AppError("CONFLICT", "This feedback already has a reply.")`; the reply form is hidden once a reply exists.
Option B: overwrite `reply`, `repliedAt`, `repliedByUserId`, and notify and email again. Write the decided behaviour here and in the tests.

## Schemas (`feedback.schemas.ts`)

- `feedbackInputSchema`: `subject` trim, 3–120; `message` trim (ends only), 10–5 000. Messages: **[PLANNER 16-A]**.
- `feedbackReplySchema`: `id` (24-hex string), `reply` trim, 2–5 000. Message: **[PLANNER 16-A]**.
- `feedbackSearchParamsSchema` for `/admin/feedback`: `tab: z.enum(FEEDBACK_STATUSES).catch("new")`, `page: z.coerce.number().int().min(1).catch(1)` (05 §1.4: a bad value falls back to its default).

**[PLANNER 16-A]** Texts the docs do not give. Recommended (same style as `theme.schemas.ts`):
subject `"Use 3 to 120 characters."`; message `"Use 10 to 5 000 characters."`; reply `"Use 2 to 5 000 characters."`;
success text of the reply form `"Reply sent."`; admin list empty state `"No feedback here yet."`.

## Mapper (`feedback.mapper.ts`) and types

`toFeedbackDTO(record)` → `{ id, subject, message, status, createdAt, reply, repliedAt }`;
`toFeedbackAdminListItemDTO(record, customer)` → `{ id, subject, createdAt, customerName, customerEmail }`;
`toFeedbackAdminDTO(record, customer)` → the full row plus `customer: { id, name, email }`. Ids become strings. Types in `feedback.types.ts`
(`FeedbackDTO`, `FeedbackAdminListItemDTO`, `FeedbackAdminDTO`, `FeedbackAdminPageDTO = { items; page; totalPages; total }`).

## Actions (`feedback.actions.ts`)

Signature `(previous: ActionResult | null, formData: FormData) => Promise<ActionResult>`; pattern 02 §5.5; `validationFailure` / `failureFrom` as in `category.actions.ts`.

| Action | Guard | Does | Result |
|---|---|---|---|
| `sendFeedbackAction` | `requireUser("/account/feedback")` | schema → `sendFeedback(user.id, …)` | `{ ok: true, data: undefined, message: FEEDBACK_SENT_MESSAGE }`; revalidate `/account/feedback`, `/admin/feedback`, and `revalidatePath("/admin", "layout")` |
| `replyToFeedbackAction` | `requireAdmin()` | reads `id`, `reply`; schema → `replyToFeedback(id, reply, admin.id)` | `{ ok: true, data: undefined, message: <16-A reply text> }`; revalidate `/admin/feedback`, `/admin/feedback/[id]` (page), `/account/feedback`, `/account/notifications` |
| `resolveFeedbackAction`, `reopenFeedbackAction` | `requireAdmin()` | read `id` → `resolveFeedback` / `reopenFeedback` | `{ ok: true, data: undefined }`; same revalidation + `revalidatePath("/admin", "layout")` |

Values sent back on failure: `{ subject, message }` for `sendFeedbackAction`, `{ reply }` for the reply (as `submittedValue` / `formKey` do in `CategoryForm.tsx`).

## Pages and components

All pages: `metadata` with `robots: { index: false }` and the title `"<Page title> · Theme Store"`.

**`/account/feedback`** — title `Feedback`. `requireUser("/account/feedback")`, `listFeedbackForUser(user.id)`.
Heading level 1 "Feedback". `FeedbackForm`: `TextField` "Subject", `TextAreaField` "Message" (`rows` 6), `SubmitButton` "Send feedback" / pending `"Sending…"`;
after a successful result show `Alert tone="success"` with the message (`FEEDBACK_SENT_MESSAGE`) and the form is empty again (`formKey`). Under the form `FeedbackList`:
one `Card` per message: subject (Heading level 3), date (`formatDate`), `Badge` with `FEEDBACK_CUSTOMER_STATUS_LABELS` (tones: new → `neutral`, read → `primary`, resolved → `success`),
the message in `<Text preserveLines>`, and when `reply` is set a nested `Card` with Heading level 3 "Our reply" and the reply in `<Text preserveLines>`.
Empty: Text `You have not sent any feedback yet.`

**`/admin/feedback?tab=&page=`** — title `Feedback`. `requireAdmin()`. Heading level 1 "Feedback". `FeedbackTabs`: `ButtonLink size="sm"` for New / Read / Resolved (`variant` primary for the current tab, else secondary; href `/admin/feedback?tab=<tab>`).
`FeedbackTable` columns: Date (`formatDate`), Customer (name, with the email under it in `Text size="sm" tone="muted"`), Subject, and a `TextLink` "Open" → `/admin/feedback/<id>`. Empty: Text of 16-A. `Pagination` with `buildHref` that keeps `tab`.

**`/admin/feedback/[id]`** — title `Feedback`. `requireAdmin()`, `openFeedbackForAdmin(id)`; `null` → `notFound()`.
Shows: Heading level 1 = the subject; `Badge` with `FEEDBACK_ADMIN_STATUS_LABELS`; Text "Customer: <name> (<email>)"; date; the message in `<Text preserveLines>`.
When a reply exists: `Card` "Your reply" with the reply and its date. Reply form (`ReplyForm`: hidden `id`, `TextAreaField` "Reply" rows 6, `SubmitButton` "Send reply" / `"Sending…"`; success `Alert`) — **shown unless 16-C option A hides it**.
`ResolveButton`: `status !== "resolved"` → `SubmitButton variant="secondary"` "Mark as resolved" (`resolveFeedbackAction`); `resolved` → "Reopen" (`reopenFeedbackAction`). Pending texts `"Saving…"`.

## Required tests

`feedback.service.test.ts` (real in-memory MongoDB, `FakeEmailSender`; use `createFeedback`, `createUser`, `createAdmin`)
- [ ] sendFeedback › saves a new message → row: `userId`, `subject`, `status "new"`, `reply null`; the ends of subject/message are trimmed, a line break inside the message is kept
- [ ] sendFeedback › writes one `feedback_sent` activity row → `actorRole "customer"`, `actorUserId` = `subjectUserId` = the user, `targetType "feedback"`, `targetId` = the feedback id
- [ ] sendFeedback › refuses the 6th message within 24 hours → AppError RATE_LIMITED `"You have sent a lot of feedback today. Please try again tomorrow."`; 5 rows; still 5 activity rows
- [ ] sendFeedback › does not count messages older than 24 hours → create 5 rows, move one back with `FeedbackModel.collection.updateOne({ _id }, { $set: { createdAt: <25 hours ago> } })` (raw call, so Mongoose timestamps do not interfere); the next message is saved (5 rows in the window, the old one not counted)
- [ ] sendFeedback › counts per user → 5 rows of another user do not block this user
- [ ] listFeedbackForUser › returns only the user's messages, newest first, with the reply when present
- [ ] listFeedbackForAdmin › returns only the tab's status, newest first, with customer name and email → 1 `new` + 1 `read` row: tab `new` returns only the new one
- [ ] listFeedbackForAdmin › paginates 20 per page → 25 rows: page 1 has 20, page 2 has 5, `totalPages` 2
- [ ] openFeedbackForAdmin › sets a new message to read and returns it → DB status `"read"`, DTO status `"read"`, customer filled
- [ ] openFeedbackForAdmin › leaves a resolved message resolved → DB status still `"resolved"`
- [ ] openFeedbackForAdmin › returns null for an unknown and an invalid id
- [ ] replyToFeedback › saves the reply, notifies and emails the customer → DB `reply`, `repliedAt = now()` (use `setTestNow`), `repliedByUserId` = admin, status unchanged; 1 notification: `type "feedback_reply"`, `title "Reply to your feedback"`, `body` = the subject, `link "/account/feedback"`, `readAt null`, `jobId null`; `fakeEmailSender.sent` has 1 email: `to` = the customer's email, `subject "Reply to your feedback: <subject>"`, `templateName "FeedbackReplyEmail"`, text contains the reply and `http://localhost:3000/account/feedback`
- [ ] replyToFeedback › still succeeds when the email fails → `fakeEmailSender.failNext(new Error("boom"))`; the call resolves; reply and notification are saved
- [ ] replyToFeedback › refuses an unknown id → NOT_FOUND with the 16-B message; 0 notifications; 0 emails
- [ ] replyToFeedback › second reply → behaviour decided in 16-C (option A: CONFLICT message, first reply unchanged, 1 notification, 1 email)
- [ ] resolveFeedback / reopenFeedback › resolve sets `"resolved"`; reopen sets a resolved row to `"read"` and leaves a `new` row `"new"`; both refuse an unknown id with the 16-B message
- [ ] countNewFeedback › counts only `new` rows → 2 new + 1 read + 1 resolved gives 2

`user.service.test.ts` (add)
- [ ] getUserSummaries › returns id, name and email for known ids and skips unknown and invalid ids → 2 users + a new ObjectId + `"x"` returns 2 items

`feedback.schemas.test.ts`
- [ ] feedbackInputSchema › trims the ends, keeps inner line breaks, refuses a 2-character subject and a 9-character message with the 16-A messages
- [ ] feedbackInputSchema › accepts exactly 120 / 5 000 characters and refuses 121 / 5 001
- [ ] feedbackSearchParamsSchema › falls back to tab `new` and page 1 for bad values (`tab=abc`, `page=0`)

`feedback.mapper.test.ts`
- [ ] toFeedbackAdminListItemDTO › turns `_id` into a string and carries customer name and email

`e2e/feedback.spec.ts` (style of `e2e/catalog.spec.ts`: `RUN_ID`, `registerAs`, admin `removeAdminAccount`; the customer and the admin each use their own browser context)
- [ ] a customer sends feedback, the admin replies, the customer sees the reply
      Customer registers, opens `/account/feedback`, fills "Subject" with `Question ${RUN_ID}` and "Message" with a 10+ character text, clicks "Send feedback" → text `Thank you! We read every message.` visible; the list shows `Question ${RUN_ID}` with the badge "Sent".
      Admin registers as `admin@example.com`, opens `/admin/feedback`, in the row containing `Question ${RUN_ID}` clicks "Open", fills "Reply", clicks "Send reply".
      Customer reloads `/account/feedback` → "Our reply" and the reply text visible, badge "Read"; `/account/notifications` shows "Reply to your feedback".
      Cleanup in `afterAll`: delete the feedback rows whose subject contains `RUN_ID`.

Break check (≥ 3): change the limit so the 6th message passes; remove the `new → read` update in `openFeedbackForAdmin`; make `replyToFeedback` throw when the email fails.

## Do NOT

- Do not add fields, statuses, activity actions or notification types. Do not log a reply or a message text anywhere.
- Do not send the email inside the transaction. Do not change the message after it was sent (customers cannot edit or delete feedback).
- Do not add threads, attachments, ratings or a second reply field.
- Feature components and pages: layout classes only (`pnpm check:styles`). `preserveLines` is the only way to keep line breaks: add it to the UI kit, never use `whitespace-pre-wrap` in a feature.
- No `any`, no `@ts-ignore`, no `eslint-disable`. Do not change or delete any existing test; only add the listed ones.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-016: feedback`
