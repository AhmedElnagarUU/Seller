# 09 — Emails and notifications

This doc covers:
- every email the store sends: its trigger, who receives it, subject and text;
- every in-app notification text;
- how notification jobs send to many people in batches through the cron route.

Decisions used here: D-047, D-111, D-112, D-116, and the new D-117 – D-119.

---

## 1. Files

```
features/emails/
├─ email.types.ts         EmailMessage, EmailSender interface
├─ email.sender.ts        getEmailSender(): Resend or console (from env.EMAIL_TRANSPORT). The ONLY file importing "resend".
├─ email.render.ts        renderEmail(template element) → { html, text } with @react-email/components render()
├─ email.service.ts       One function per email in section 3 (send...Email). Builds the message, renders, sends.
└─ templates/
   ├─ EmailLayout.tsx      Shared frame: store name, content, footer (support email, optional settings link)
   ├─ VerifyEmail.tsx, ResetPasswordEmail.tsx, OrderConfirmationEmail.tsx,
   ├─ WalletApprovedEmail.tsx, WalletRejectedEmail.tsx, AdminWalletReviewEmail.tsx,
   ├─ FeedbackReplyEmail.tsx, ThemeUpdateEmail.tsx, NewThemeInCategoryEmail.tsx, AnnouncementEmail.tsx

features/notifications/
├─ notification.model.ts / .repository.ts / .service.ts / .mapper.ts / .actions.ts / .types.ts / .constants.ts
├─ notification-job.model.ts / notification-job.repository.ts
├─ notification-job.service.ts    createVersionReleasedJob, createThemePublishedJob, createAnnouncementJob
├─ notification-job.processor.ts  processNotificationJobs(): the cron work (section 5)
├─ notification-cron.handler.ts   handleNotificationCron(request): Response — used by the route (section 5.1)
├─ notification.texts.ts          Title/body/link builders for every notification type (section 4)
└─ components/                    NotificationBell, NotificationList, ...
```

### 1.1 `email.types.ts`

```ts
export type EmailMessage = {
  to: string;                 // one address
  subject: string;
  html: string;
  text: string;
  templateName: string;       // e.g. "ThemeUpdateEmail" — for logs and FakeEmailSender
};

export interface EmailSender {
  // Sends one email. Throws on failure.
  send(message: EmailMessage): Promise<void>;
  // Sends up to 100 emails in ONE request. idempotencyKey makes a retry with the same key send nothing twice.
  sendBatch(messages: EmailMessage[], idempotencyKey: string): Promise<void>;
}
export class EmailRateLimitError extends Error {}   // thrown when the provider answers 429
```

### 1.2 `email.sender.ts`

- `env.EMAIL_TRANSPORT === "resend"` → Resend implementation:
  - `send` uses `resend.emails.send({ from: env.EMAIL_FROM, to, subject, html, text, replyTo: env.SUPPORT_EMAIL })`.
  - `sendBatch` uses `resend.batch.send([...], { idempotencyKey })`.
  - A 429 answer throws `EmailRateLimitError`. Any other `error` in the response throws `Error("EMAIL_SEND_FAILED")`.
    Never log the email body or the recipient list.
- `env.EMAIL_TRANSPORT === "console"` → console implementation. It prints
  `[email] <templateName> to=<to> subject=<subject>` plus the `text` part, using `console.warn`.
  It is used for local development and E2E. `env.ts` refuses `console` when `NODE_ENV=production` (D-119).
- `FakeEmailSender` (`10-testing.md` section 4) implements the same interface. It records `sent`, and can be told to
  fail the next call with a normal error or with `EmailRateLimitError`.

### 1.3 Sending rules

- **Emails are sent after the database transaction**, never inside it.
- A failed single email is logged (`console.error("send<Name>Email failed", templateName)`) and **does not change
  the action's result**. The exception is Better Auth emails (section 3, #1–#2), where Better Auth handles the error.
- Every email has both an HTML and a plain-text part, generated from the same React template.
- All links in emails are absolute: `env.APP_URL + path`.
- Emails never contain prices from the browser, download links (`/api/downloads/...`) or signed URLs.

---

## 2. Shared layout (`EmailLayout`)

```
[Theme Store]                                   ← text logo, links to APP_URL

<content of the email>

—
Questions? Reply to this email or write to <SUPPORT_EMAIL>.
<optional line> You get this email because <reason>. Change your email settings: <APP_URL>/account/settings
```

- The optional line appears only on emails a customer can turn off (#7–#10).
- **Unsubscribing** (D-117) means switching the email off in `/account/settings`. The link goes there, and the
  customer logs in first if needed. There is no one-click unsubscribe token in the MVP.
- One primary button per email at most, rendered with `@react-email/components` `Button`. Colors are hard-coded
  inside `EmailLayout.tsx` only. Email clients cannot read `tokens.css`, so this is the one allowed exception to
  D-130, and only for `features/emails/templates/**`.

---

## 3. Every email

`<Theme>` = theme name, `<Name>` = the customer's name.

| # | Email | Trigger | To | Subject | Can turn off? |
|---|---|---|---|---|---|
| 1 | Verify email | Registration with email + password (Better Auth `sendVerificationEmail`) | the user | `Confirm your email address` | No |
| 2 | Reset password | "Forgot password" (Better Auth `sendResetPassword`) | the user | `Reset your password` | No |
| 3 | Order confirmation | Card order created by the webhook (`06-payments.md` 6.3) | buyer | `Your purchase: <Theme>` | No |
| 4 | Wallet approved | Admin approves a wallet payment | buyer | `Payment approved: <Theme> is yours` | No |
| 5 | Wallet rejected | Admin rejects a wallet payment | customer | `We could not confirm your payment for <Theme>` | No |
| 6 | Admin: new wallet payment | Customer submits wallet proof | first address in `ADMIN_EMAILS` | `New wallet payment to review: <reference>` | No |
| 7 | Theme update (owner) | Notification job, stage `theme_owners` | owner | `<Theme> <version> is available` | Yes: `emailOwnedThemeUpdates` |
| 8 | Theme update (favorite) | Notification job, stage `theme_favoriters` | user who favorited | `<Theme> <version> is out` | Yes: `emailFavoriteThemeUpdates` |
| 9 | New theme in category | Notification job, stage `category_followers` | follower | `New in <Category>: <Theme>` | Yes: `emailFollowedCategoryThemes` |
| 10 | Announcement | Notification job (announcement with "Also send by email") | audience | `<announcement title>` | Yes: `emailAnnouncements` |
| 11 | Feedback reply | Admin replies to feedback | customer | `Reply to your feedback: <subject>` | No |

### 3.1 Texts

Each text below is the email content inside `EmailLayout`. Lines starting with **[Button]** are the one button.

**#1 Verify email**: `sendVerifyEmail({ to, name, url })`
> Hi `<Name>`,
> Please confirm your email address to finish creating your account.
> **[Button] Confirm email** → `url` (from Better Auth)
> If you did not create an account, you can ignore this email.

**#2 Reset password**: `sendResetPasswordEmail({ to, name, url })`
> Hi `<Name>`,
> We received a request to reset your password. This link works for 1 hour.
> **[Button] Reset password** → `url`
> If you did not ask for this, you can ignore this email. Your password stays the same.

**#3 Order confirmation**: `sendOrderConfirmationEmail({ orderId })` (loads order, user and theme)
> Hi `<Name>`,
> Thank you for buying **`<Theme>`**. It is now in your account, with free updates for life.
> Order: `<order id>` · Date: `formatDate(paidAt)` · Paid: `formatPrice(totalAmount, currency)`
> (only when there was a discount) Coupon `<code>`: −`formatPrice(discountAmount, currency)`
> **[Button] Download your theme** → `/account/themes`
> Your receipt from our payment partner Polar was sent in a separate email.

**#4 Wallet approved**: `sendWalletApprovedEmail({ walletPaymentId })`
> Hi `<Name>`,
> We received your payment of **`<amountEgp>` EGP** (reference `<referenceCode>`). **`<Theme>`** is now yours, with free updates for life.
> **[Button] Download your theme** → `/account/themes`

**#5 Wallet rejected**: `sendWalletRejectedEmail({ walletPaymentId })`
> Hi `<Name>`,
> We could not confirm your wallet payment for **`<Theme>`** (reference `<referenceCode>`).
> Reason: `<rejectionReason>`
> If you already sent the money, reply to this email with your transfer details and we will help you.
> **[Button] View payment** → `/account/wallet-payments/<id>`

**#6 Admin: new wallet payment**: `sendAdminWalletReviewEmail({ walletPaymentId })`
> A customer submitted a wallet payment.
> Customer: `<name>` (`<email>`) · Theme: `<Theme>` · Amount: `<amountEgp>` EGP · Reference: `<referenceCode>` · Sender phone: `<senderPhone>`
> Check that the money arrived before approving.
> **[Button] Review payment** → `/admin/wallet-payments/<id>`

**#7 Theme update (owner)**
> Hi `<Name>`,
> A new version of **`<Theme>`** is ready: **`<version>`** (`formatDate(releasedAt)`).
> What changed: one line per change, `New: …` / `Improved: …` / `Fixed: …` / `Removed: …` (max 10 lines; if more: `…and <n> more changes.`)
> **[Button] Download the update** → `/account/themes`
> Reason line: `you own <Theme>`.

**#8 Theme update (favorite)**
> Hi `<Name>`,
> **`<Theme>`**, a theme you favorited, has a new version: **`<version>`**.
> What changed: same list as #7.
> **[Button] See the theme** → `/themes/<slug>`
> Reason line: `you favorited <Theme>`.

**#9 New theme in category**
> Hi `<Name>`,
> A new theme was just added to **`<Category>`**: **`<Theme>`**: `<tagline>`
> **[Button] See the theme** → `/themes/<slug>`
> Reason line: `you follow <Category>`.

**#10 Announcement**
> Hi `<Name>`,
> `<announcement body>` (plain text; line breaks kept)
> (only when `link` is set) **[Button] Learn more** → `link`
> Reason line: `you are a customer of Theme Store`.

**#11 Feedback reply**: `sendFeedbackReplyEmail({ feedbackId })`
> Hi `<Name>`,
> We replied to your feedback "**`<subject>`**":
> `<reply>` (plain text; line breaks kept)
> **[Button] View feedback** → `/account/feedback`

Emails #7–#10 are built by the processor (section 5), not by single `send...Email` calls. `email.service.ts` exports
`buildThemeUpdateEmail(...)`, `buildFavoriteUpdateEmail(...)`, `buildNewThemeInCategoryEmail(...)` and
`buildAnnouncementEmail(...)`. Each returns an `EmailMessage`.

---

## 4. In-app notification texts (`notification.texts.ts`)

| Type | Title | Body | Link |
|---|---|---|---|
| `owned_theme_updated` | `<Theme> <version> is available` | First change text, max 200 chars (`+ <n> more` when more) | `/account/themes` |
| `favorite_theme_updated` | `<Theme> <version> is out` | same | `/themes/<slug>` |
| `category_new_theme` | `New in <Category>: <Theme>` | `<tagline>` | `/themes/<slug>` |
| `announcement` | `<announcement title>` | `<announcement body>` | `<announcement link>` or `null` |
| `wallet_payment_approved` | `Payment approved: <Theme>` | `Your payment of <amountEgp> EGP was confirmed. You can download the theme now.` | `/account/themes` |
| `wallet_payment_rejected` | `Payment not confirmed: <Theme>` | `Reason: <rejectionReason>` | `/account/wallet-payments/<id>` |
| `feedback_reply` | `Reply to your feedback` | `<subject>` | `/account/feedback` |

If a title or body would exceed the limits in `03-data-model.md` section 12 (120 / 1 000 chars), cut it and end it
with `…`.

---

## 5. Notification jobs: sending to many people (D-116)

### 5.1 The cron route

`app/api/cron/process-notifications/route.ts` exports `POST`, which returns `handleNotificationCron(request)`.

`handleNotificationCron`:
1. The `Authorization` header must equal `Bearer <env.CRON_SECRET>`. Compare with `timingSafeEqual`.
   Otherwise return `401` with an empty body.
2. Run `processNotificationJobs()` and return `200` with JSON `{ processedBatches, finishedJobs }`.
3. On an unexpected error: `console.error("notification cron failed", err)` and return `500`.

**On the VPS** (deployment doc), crontab runs every minute:
```
* * * * * curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/process-notifications > /dev/null
```

### 5.2 `processNotificationJobs()`

Constants in `notification.constants.ts`:
- `JOB_BATCH_SIZE = 100` (Resend's batch maximum)
- `MAX_BATCHES_PER_RUN = 10`
- `JOB_LOCK_SECONDS = 120`
- `MAX_JOB_ATTEMPTS = 5`

```
batches = 0
while batches < MAX_BATCHES_PER_RUN:
    job = claimNextJob()                 # 5.3; none → stop
    result = processOneBatch(job)        # 5.4
    batches += 1
    if result == "rate_limited": release lock, stop the run
return { processedBatches: batches, finishedJobs }
```

### 5.3 Claiming a job (only one cron run works on a job at a time)

One atomic `findOneAndUpdate`:
- Filter:
  - `status` in `["pending", "running"]`
  - `lockedUntil` is `null` **or** < `now()`
- Sort: `{ createdAt: 1 }`
- Update:
  - `status: "running"`
  - `lockedUntil: now() + 120 s`
  - `startedAt` set when it was `null`, using an aggregation pipeline update or a second update

This needs a new field on `notificationJobs`: `lockedUntil` (Date, nullable). It is added to `03-data-model.md` section 13.

### 5.4 `processOneBatch(job)`

The audience sources per stage are in `03-data-model.md` section 13.
- `theme_owners`: `ownerships` with `{ themeId, status: "active" }`
- `theme_favoriters`: `favorites` with `{ targetType: "theme", targetId: themeId }`
- `category_followers`: `favorites` with `{ targetType: "category", targetId: categoryId }`
- `all_customers`: `user` with `disabled: false`
- `one_customer`: that one user

Every source is read in `_id` order, after `job.cursor`.

| # | Step |
|---|---|
| 1 | Read the next `JOB_BATCH_SIZE` source rows with `_id > cursor` (or from the start when `cursor` is `null`). |
| 2 | **No rows** → if there is a next stage: set `stage` to it, `cursor: null`, `lockedUntil: null` and return `"ok"`. Otherwise set `status: "done"`, `finishedAt: now()`, `lockedUntil: null`, `finishedJobs += 1` and return `"ok"`. |
| 3 | Load these users through the users service (`getUsersForNotification(userIds)` → id, name, email, disabled, the 4 email switches). Drop disabled users. Drop admins: their email is in `ADMIN_EMAILS`. |
| 4 | Drop users who already have a notification for this job: `notifications` with `{ jobId, userId: { $in } }`. These users were reached in an earlier stage, or in an earlier try of this batch. |
| 5 | Build emails for the remaining users whose email switch for this stage is on (#7–#10). For announcements, only when `announcement.sendEmail` is `true`. |
| 6 | If there are emails: `sendBatch(emails, "job-<jobId>-<stage>-<first source row _id>")`. |
| 7 | Insert one notification per remaining user (`insertMany`, `ordered: false`; ignore duplicate-key errors), with texts from section 4 and `jobId`. |
| 8 | Update the job: `cursor` = last source row `_id`, `notifiedCount += inserted`, `emailedCount += emails.length`, `lockedUntil: null`. Return `"ok"`. |

Errors inside steps 1–8:
- `EmailRateLimitError` → set `lockedUntil: null` and return `"rate_limited"`. This does **not** count as an attempt.
- Any other error:
  - `attempts += 1`, `error` = the message (max 500 chars, no personal data), `lockedUntil: null`.
  - When `attempts` reaches `5`: `status: "failed"`, `finishedAt: now()`.
  - `console.error("notification batch failed", jobId)`.
  - The cursor does **not** move, so the same batch is tried again on the next run.

Why this order is safe:
- Emails go out **before** notifications are written.
- If writing fails, the retry sends the same batch with the **same idempotency key**, so Resend does not send the
  emails twice (Resend keeps keys for 24 hours).
- Step 4 makes sure nobody gets two notifications from one job.

### 5.5 Admin view

`/admin/notifications` lists announcement jobs. The admin version list shows each version's job. Each shows
`status`, `notifiedCount` and `emailedCount`, plus `error` when `failed`.
A `failed` job has a **Retry** button (`retryNotificationJobAction`). It sets `status: "pending"`, `attempts: 0` and
`error: null`, and keeps the cursor.

---

## 6. New decisions and env variables

| ID | Decision | Status |
|---|---|---|
| D-117 | Unsubscribe = the settings link in the email footer (login needed). No one-click unsubscribe token in the MVP. | DEFAULT |
| D-118 | Bulk emails use Resend's batch API (100 per request) with an idempotency key per batch. In-app notifications are always created; emails follow the user's switches. Admins never receive bulk notifications. | DEFAULT |
| D-119 | `EMAIL_TRANSPORT=console` prints emails instead of sending them, for local development and E2E. It is refused when `NODE_ENV=production`. | DEFAULT |

| Name | Example | Notes |
|---|---|---|
| `EMAIL_TRANSPORT` | `resend` or `console` | New. `console` refused in production. |

`RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL` and `CRON_SECRET` are already in `02-architecture.md` section 10.

**Owner note:**
- Resend's free plan allows **100 emails per day**. That is enough for launch, but not for bulk update emails to
  many customers. Move to a paid plan before your customer list passes ~100.
- Verify your domain in Resend (DNS records) before launch, or emails land in spam.

---

## 7. Required tests

**`notification-job.processor.test.ts`** (real in-memory MongoDB, `FakeEmailSender`, `setTestNow`)
- `processNotificationJobs` › notifies active owners, then favoriters; a user who is both gets **one** notification
  (type `owned_theme_updated`) and one email
- skips revoked owners, disabled users and admins
- sends emails only to users with the matching switch on; still creates in-app notifications for the others
- announcement with `sendEmail: false` creates notifications and sends 0 emails
- announcement to `theme_owners` reaches only active owners of that theme
- processes 250 owners in 3 batches; `notifiedCount` = 250; job `done` with `finishedAt`
- a job locked by another run (`lockedUntil` in the future) is not picked; it is picked after the lock expires
- an email failure leaves the cursor unchanged, adds 1 to `attempts` and writes 0 notifications for that batch
- after 5 failures the job is `failed`
- `EmailRateLimitError` stops the run without adding to `attempts`
- running the same batch again after a failure in step 7 uses the same idempotency key (checked on `FakeEmailSender.sent`)

**`notification-cron.handler.test.ts`**
- refuses a missing or wrong secret → 401; no job changed
- correct secret → 200 with `{ processedBatches, finishedJobs }`

**`email.service.test.ts`**
- order confirmation contains the theme name, the formatted total and the absolute link `<APP_URL>/account/themes`
- theme update email lists max 10 changes, then `…and <n> more changes.`
- optional emails (#7–#10) contain the settings link; payment emails (#3–#6) do not
- no email contains `/api/downloads/`

**`notification.texts.test.ts`**
- titles over 120 characters are cut and end with `…`
