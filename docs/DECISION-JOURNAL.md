# Decision journal

The story of **why** the store is built the way it is: the important choices, the reasons behind them, what was
rejected, what each choice costs us, and what changed while building. Read this to understand the product. Read
`01-decisions.md` for the short list of every rule (D-numbers), and the numbered docs for the details.

Written 2026-11-20, after all 21 build tasks were finished and merged, before launch.

**How to read an entry:** *Decision* → *Why* → *Rejected* (what we did not do) → *Cost / watch out* → *Refs*.

---

## 1. What we are building

A store where **one seller (the owner) sells premium WordPress themes**. A customer pays once per theme and can
download every future version for life. Customers in Egypt can also pay with an Egyptian wallet.

The whole product follows one idea: **keep it small enough for one person to run.** Most decisions below choose the
simpler option, even when a bigger system would look more "complete".

---

## 2. The business model

### 2.1 One seller, paid themes only, one-time purchase
- **Decision:** No marketplace, no free themes, no subscriptions or all-access plan. One purchase = one theme, forever.
- **Why:** The simplest model to build, explain and support. "Buy once, update forever" is the strongest promise for
  this market.
- **Rejected:** Subscriptions (recurring billing, failed-card handling, churn emails); a marketplace (seller payouts,
  moderation).
- **Cost / watch out:** Income comes only from new sales; lifetime updates are a long-term promise
  (the Terms define "lifetime").
- **Refs:** D-001 – D-004.

### 2.2 Updates by email + manual download, no license keys
- **Decision:** A new version triggers a notification and an email; the customer downloads the zip from "My themes".
- **Why:** Automatic WordPress updates need an update server and license keys — a second product. Manual download is
  what many theme shops do at the start.
- **Rejected:** In-WordPress auto-update, license-key activation.
- **Cost / watch out:** Customers must re-upload the theme themselves. The database already has a `licenseType` field,
  so license tiers can come later without a migration.
- **Refs:** D-005, D-006.

### 2.3 No cart, USD only, money as whole cents
- **Decision:** One checkout buys exactly one theme. All prices are in US dollars, stored as integer cents (`2900` = $29.00).
- **Why:** A cart adds complexity for little gain when people usually buy one theme. Integers avoid rounding mistakes.
- **Cost / watch out:** Buying three themes takes three checkouts.
- **Refs:** D-007, D-008.

### 2.4 Versions are permanent
- **Decision:** A version can never be deleted and its zip never replaced. A mistake is fixed by releasing a higher
  version. Version numbers must always go up (1.10.0 > 1.9.0).
- **Why:** Customers and the changelog can always trust a version number; nobody downloads a file that silently changed.
- **Cost / watch out:** A bad upload stays in the history. Keep your original zips on your own computer as well.
- **Refs:** D-015, D-019.

### 2.5 Refunds
- **Decision:** A **full** refund removes access to the theme; a partial refund (a goodwill discount) keeps it.
  Card refunds come from Polar automatically. Wallet refunds are done by hand: you send the money back, then click
  "Mark as refunded".
- **Why:** Matches what customers expect and what the payment providers can tell us.
- **Refs:** D-011, D-014, D-105.

---

## 3. Payments

### 3.1 Polar for cards, behind a wall we can replace
- **Decision:** Polar takes card payments. All Polar code lives in one folder behind a `PaymentProvider` interface;
  nothing else imports the Polar SDK.
- **Why:** Polar is a "merchant of record": it handles sales tax/VAT for us — a big burden for a solo seller.
  The interface means changing provider later touches one folder.
- **Rejected:** Stripe directly (we would handle tax ourselves); Polar's own file-delivery "benefits" (we deliver files
  ourselves, so ownership rules stay in our database).
- **Cost / watch out:** Polar reviews new sellers — **create the account early**. The SDK is pinned at 1.0.2; newer
  versions exist (Q-016): upgrade only after a sandbox test on staging.
- **Refs:** D-030 – D-036, Q-016.

### 3.2 Our database is the truth, not Polar
- **Decision:** Themes, coupons, orders and ownership live in MongoDB. Polar only takes the money and tells us by
  webhook. Products and discounts are created in **our** admin and copied to Polar ("sync").
- **Why:** One place to look; the store keeps working the same way if the provider changes.
- **Cost / watch out:** A sync can fail (Polar down). Then the admin shows "Not synced with payment provider" and a
  **Sync now** button; a theme cannot be published until it is synced.
- **Refs:** D-031, D-033, T-010.

### 3.3 Ownership is given only by trusted events
- **Decision:** A customer owns a theme only after: Polar's signed webhook, an admin approving a wallet payment, or an
  admin grant. Never because someone reached the "thank you" page.
- **Why:** The thank-you page can be opened by anyone; the webhook is signed by Polar.
- **Cost / watch out:** After paying, the customer may wait a few seconds ("Confirming your payment…").
  Webhooks are processed **once** even if Polar sends them twice (tested).
- **Refs:** D-034, D-035, T-012.

### 3.4 Our own checkout page, coupons checked by our server
- **Decision:** Every purchase starts on `/checkout/<theme>`. The coupon is typed and checked there; Polar receives
  only the matching discount id. Customers cannot type codes on Polar's page.
- **Why:** One coupon system for both card and wallet payments.
- **Refs:** D-103, D-009.

### 3.5 Egyptian wallet payments (manual)
- **Decision:** Customers whose country is Egypt can pay by Vodafone Cash / InstaPay transfer: they get a reference
  code, send the money, upload a screenshot; you approve or reject in the admin.
- **Why:** Polar does not support these wallets, and many Egyptian customers have no international card.
- **Rejected:** An Egyptian payment gateway (paperwork, fees, another integration) — can come later.
- **Cost / watch out:** It is manual work for you. **Always check the money really arrived** before approving.
  The EGP price is `ceil(USD price after coupon × your exchange rate)`, fixed when the request is made.
  Revenue is always shown per currency, never added together.
- **Refs:** D-100 – D-105, D-124, T-013.

---

## 4. Coupons — the decision that changed

- **Original decision (D-018, first version):** after creation only *active*, *expiry* and *usage limit* could change;
  code, discount and themes were fixed, and coupons were never deleted.
- **Changed by the owner on 2026-11-17:** every field can be edited, and coupons can be deleted.
- **Why the change:** The owner wants full control in daily work; making a new coupon for every small change was
  too strict.
- **How we made it safe:**
  - Orders keep their own amounts and a **copy of the code**, so old orders never change.
  - When the code, discount or themes change, the store creates a **new** Polar discount and deletes the old one
    (more reliable than editing a discount at Polar).
  - Only themes already synced with Polar can be chosen, so a coupon always works at card checkout.
  - If a coupon is deleted while someone is paying, the order is still saved — without the coupon — because the money
    was already taken.
- **Refs:** D-018 (changed), T-011, T-012.

---

## 5. Accounts and safety

### 5.1 Better Auth, email + Google, verified email before buying
- **Decision:** Better Auth handles accounts. Customers log in with email + password or Google. An account is needed to
  buy, and the email must be verified first (Google counts as verified).
- **Why:** Ownership needs a real account; verification prevents fake or mistyped emails receiving paid files.
- **Refs:** D-020 – D-023.

### 5.2 Admin = a verified email on a list
- **Decision:** There is no "admin" role in the database. An admin is an account whose email is in `ADMIN_EMAILS`
  **and is verified**.
- **Why:** No admin sign-up page that could be attacked.
- **Changed during the security review (2026-11-20):** the first version did not check verification. Anyone who
  registered with the admin address before the owner would have had the full admin panel. Fixed (D-152).
- **Cost / watch out:** Register with your admin email and click the verification link (or use Google) before the
  admin panel opens.
- **Refs:** D-024, D-152.

### 5.3 Disabling accounts, giving and removing themes
- **Decision:** The admin can disable an account (all its sessions end at once; data stays), give a theme for free,
  and remove any theme with a reason.
- **Refs:** D-012, D-120 – D-122, T-017.

### 5.4 Security fixes added before launch (2026-11-20)
A review of the finished code found and fixed:
- **Password guessing was unlimited.** Better Auth's built-in limits only cover its own web routes, and our forms
  call it directly. We now allow 5 failed logins per email + IP and 50 per IP in 15 minutes, and 3 reset or
  verification emails per address per hour (D-150).
- **Open redirect after login.** `/login?next=/\evil.com` sent people to another site. Fixed.
- **Browser security headers** were missing (anti-clickjacking, nosniff, HSTS). Added (D-151).
- **Not added yet (on purpose):** a Content-Security-Policy and error tracking (Sentry). Both are worth adding after
  launch.

---

## 6. Customer engagement

- **Favorites and follows:** customers favorite themes and follow categories, and hear about new versions and new
  themes (D-110).
- **Notification center + emails:** every customer has a bell and a notifications page; emails follow per-type
  switches in settings; payment and feedback-reply emails cannot be turned off (D-111).
- **Sending to many people is done in the background:** a new version or an announcement creates a "job"; a cron call
  every minute sends it in batches. **Why:** sending 2,000 emails inside the admin's click would time out (D-116, D-118).
- **Feedback inbox:** customers write to you; you reply **once** per message (owner decision), they get a notification
  and an email (D-113, T-016).
- **Announcements:** to all customers, the owners of one theme, or one customer, with an optional email (D-112).
- **Search:** a simple "contains" search on name and tagline, no search engine (D-115). Enough for a catalog of tens of themes.

---

## 7. Files: images and zips

- **Decision:** Files go **directly from the browser to storage** (presigned upload links), never through our server.
  Zips are in a **private** bucket and downloaded through links that expire after 5 minutes; images are in a public
  bucket. The database stores only file keys, never full URLs.
- **Why:** Large zips don't load our small server; private zips cannot be shared by link; changing provider or CDN
  needs no database change.
- **Provider:** Cloudflare R2 in production and staging — **downloads cost nothing** (no egress fees).
- **Limits:** 30 downloads per customer per hour; images JPG/PNG/WebP up to 3 MB and 400–6000 px; zips up to 200 MB.
- **Changed during the build:** local development and CI first used MinIO. Its Docker images can no longer be
  downloaded (also on GitHub), so they were replaced by an S3 stand-in (moto). It is for testing only; real uploads
  are checked on staging with R2.
- **Refs:** D-049 – D-059, D-054 (updated), Q-011.

---

## 8. Technology

| Choice | Why | Rejected |
|---|---|---|
| Next.js + TypeScript (strict) | One codebase for pages and server logic; widely known | Separate frontend + API server |
| MongoDB Atlas + Mongoose | Flexible documents; free tier to start | SQL + migrations |
| Tailwind + our own small UI kit | Full control of the look, no heavy library | shadcn, MUI |
| zod | Every outside input is checked the same way | Hand-written checks |
| Resend | Simple API, batch sending | Self-hosted mail |
| Vitest + Playwright | Fast unit tests + real browser tests | — |
| One DigitalOcean server + Docker + Caddy, Cloudflare in front | Cheap, the owner already has it, HTTPS and DNS handled by Cloudflare | Vercel (serverless limits for cron and long jobs), Kubernetes |

**Refs:** D-040 – D-048, D-140 – D-147.

---

## 9. How the code is organised

- **Feature folders** (`src/features/themes`, `orders`, `coupons`…), each with model → repository → service →
  actions → components. **No layer is skipped.**
- **Business logic never imports Next.js**, so it could move to another framework.
- **Features talk only through services**, never through each other's database code.
- **Styling is separated from logic:** colors and fonts live in `src/styles/tokens.css`; only the UI kit may style.
  A redesign touches the UI kit, not the features.
- **Tests test real logic** against a real (in-memory) database; only Polar, storage and email are replaced by fakes.
  Every feature has "break checks": we break the code on purpose and confirm a test catches it.
- **Why all this:** the code was written by AI agents task by task. Strict, repeated patterns make each task
  predictable and reviewable, and make the code easy for a person to take over.
- **Refs:** D-084 – D-092, D-130 – D-134.

---

## 10. How it was actually built (and where it differed from the plan)

- **Plan:** a planner writes docs and task files; a cheaper agent builds each task on its own branch with its own pull
  request, merged into `main` after green CI (D-080 – D-083).
- **What happened:** T-001 – T-004 were built first as reference code and reviewed by the planner, committed
  straight to the planning branch. T-005 – T-021 were built by Claude sub-agents, one task at a time, on one work
  branch; each was reviewed and fully re-tested by the planner, then merged straight into the main branch (the owner
  approved merging without pull requests). No pull requests or GitHub Issues were used. The repository has no branch named `main`, so
  CI was set to run on the real main branch name.
- **Owner decisions taken during the build:** Polar keys required only with Polar; publish texts and activity-log
  wording; coupons fully editable and deletable; only synced themes in coupons; coupon expiry at the end of the day
  (UTC); a paid order with a vanished coupon is saved without it; one reply per feedback; free themes can be any
  theme, note optional; legal pages start from the drafts; all proposed interface texts accepted.
- **Problems found only by running things:**
  - CI could never have passed (missing settings) and had never run.
  - MinIO images disappeared.
  - Images were blocked locally.
  - A few timing-sensitive tests were flaky.
  - The four security problems in section 5.4.

  All were fixed before this journal was written. Every question raised while building is answered in `QUESTIONS.md`.

---

## 11. What we deliberately left out (for now)

| Left out | Why | When to revisit |
|---|---|---|
| License keys, WordPress auto-updates | A second product | When customers ask for it |
| Shopping cart, bundles, subscriptions | Complexity | After first sales data |
| Other currencies and languages (only USD and English) | Simplicity | When the audience needs it |
| Automatic Egyptian wallet payments | Gateway paperwork | When wallet volume grows |
| Error tracking (Sentry), Content-Security-Policy | Not needed to launch | Soon after launch |
| Clean-up of abandoned uploads | Cost is negligible | If storage grows |
| Search engine | A few dozen themes don't need it | If the catalog grows large |

---

## 12. Things to remember

1. **Never put a key or password in the code, a chat or an issue.** They live only in the env files on the server.
2. **Test on staging before production**, and every time payments change (`LAUNCH.md` step 6).
3. **Production gets a tested git tag**, never "whatever is on the branch".
4. **Keep your original theme zips** on your own computer.
5. **Check the money really arrived** before approving a wallet payment.
6. New decisions go into `01-decisions.md` (next number **D-153**) and, if they change the story, into this journal.
