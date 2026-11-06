# T-019: Account overview and settings, info pages, contact, demo preview, sitemap and robots

- Depends on: T-018 (and so T-005 … T-017, all merged into `main`)
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2.3, 5, 8, 9; `docs/03-data-model.md` section 3 (extra user fields, `account`);
  `docs/05-pages.md` sections 1, 3 (rows `/themes/[slug]/preview`, info pages, `/contact`, "Search rules", "SEO files") and 4 (rows `/account`, `/account/settings`);
  `docs/00-product.md` 3.1 (live demo), 3.2, 3.7, 3.8, 5; `docs/01-decisions.md` D-061, D-102, D-111, D-117; `docs/09-emails.md` 2 (settings link);
  `docs/10-testing.md` sections 2, 8 (flow 1).
  Copy the form pattern of `src/features/categories/components/admin/CategoryForm.tsx` and the layer pattern of `src/features/categories/`.

## Goal

The last pieces of 05 §3–§4 that no earlier task built:
1. **`/account` overview** (replaces the temporary page of T-003) and **`/account/settings`** (profile, password, e-mail switches, delete-account note).
2. **Info pages** (`/about`, `/terms`, `/privacy`, `/refund-policy`, `/license`) and **`/contact`**.
3. **Demo preview** `/themes/[slug]/preview` (D-061) and the "Live demo" button that points to it.
4. **SEO files:** `app/sitemap.ts` and `app/robots.ts`.

**Not in this task:** writing the legal texts (the owner does; this task creates short placeholder files); the notification centre page and bell (T-014); account deletion from the UI (00 §6); changing e-mail address; Google-account password creation.

## Files

```
src/features/auth/auth.service.ts              (change) add updateUserName, changeUserPassword (Better Auth calls, like the other functions of this file)
src/features/auth/auth.messages.ts             (change) add wrongCurrentPassword
src/features/auth/auth.service.test.ts         (change) ONLY add the 3 tests below

src/features/users/
  user.repository.ts          (change) add setEmailPreferences, hasCredentialAccount
  account.service.ts          (new) getAccountOverview, getAccountSettings, updateProfile, changePassword, updateEmailPreferences
  account.schemas.ts          (new) profileSchema, changePasswordSchema, emailPreferencesSchema
  account.messages.ts         (new) ACCOUNT_MESSAGES
  account.types.ts            (new) AccountOverviewDTO, AccountSettingsDTO
  account.actions.ts          (new) updateProfileAction, changePasswordAction, updateEmailPreferencesAction
  account.service.test.ts     (new)
  account.schemas.test.ts     (new)
  components/AccountOverview.tsx
  components/ProfileForm.tsx                  ("use client")
  components/PasswordForm.tsx                 ("use client")
  components/EmailPreferencesForm.tsx         ("use client")
  components/DeleteAccountCard.tsx

src/shared/test/session-headers.ts            (new) createSessionHeaders(email, password): Promise<Headers>  (test helper)

src/features/themes/theme.repository.ts       (change) add findPublishedThemeSlugs
src/features/themes/theme.service.ts          (change) add listBestSellingThemes(limit), listPublishedThemeSlugs()
src/features/themes/theme.service.test.ts     (change) ONLY add the 2 tests below
src/features/themes/components/ThemeDetail.tsx (change) "Live demo" → ButtonLink to /themes/<slug>/preview
src/features/themes/components/DemoPreview.tsx ("use client") top bar, device switch, frame
src/shared/ui/EmbedFrame.tsx                  (new) the iframe with its visual classes
src/shared/layout/FullScreenFrame.tsx         (new)
src/shared/layout/PreviewBar.tsx              (new)

src/features/content/
  content.constants.ts        INFO_PAGES
  content.types.ts            InfoPageDTO
  content.repository.ts       readContentFile(slug)
  content.service.ts          getInfoPage(slug)
  content.service.test.ts
  components/InfoPage.tsx
src/content/about.md, terms.md, privacy.md, refund-policy.md, license.md

src/app/account/page.tsx                      (replace the temporary page)
src/app/account/settings/page.tsx
src/app/about/page.tsx, terms/page.tsx, privacy/page.tsx, refund-policy/page.tsx, license/page.tsx
src/app/contact/page.tsx
src/app/themes/[slug]/preview/layout.tsx
src/app/themes/[slug]/preview/page.tsx
src/app/sitemap.ts
src/app/robots.ts
src/app/sitemap.test.ts
src/app/robots.test.ts

e2e/account.spec.ts
e2e/storefront.spec.ts
e2e/auth.spec.ts                              NOT changed (see "The overview heading")
```

**[PLANNER 19-F]** Functions of earlier tasks used by the overview (names are not repeated in the docs): the notification list function of T-014 (`listNotifications(userId, page)` in 05 §4, returns the DTOs of the notification page; take the first 5 of page 1), the T-014 function that counts a user's unread notifications (the one behind the AccountShell badge), and `listWalletPaymentsForUser(userId)` (T-013, 05 §4; only its `status` field is used). Planner: write the exact names, parameters and DTO type names before handing this task out. Also used: `countActiveOwnershipsByUser(userIds)` (T-017), `listBestSellingThemes` (this task).

The account pages get their frame (`AccountShell`) from `src/app/account/layout.tsx`, written in T-009. New account pages do **not** wrap themselves in `AccountShell`.
If that layout file does not exist, stop and write a question in `docs/QUESTIONS.md`.

## Packages

None (`react-markdown` is already installed; Better Auth, Mongoose and zod are used as they are).

---

## Part 1 — Account overview

### Types (`account.types.ts`)

```ts
export type AccountOverviewDTO = {
  ownedCount: number;                       // active ownerships
  unreadCount: number;
  latestNotifications: NotificationDTO[];   // newest first, at most 5 (type from T-014, see 19-F)
  bestSellers: ThemeCardDTO[];              // at most 4
  openWalletPayments: number | null;        // number of requests in status awaiting_payment or submitted; null when the user's country is not "EG"
};
```

### Theme service additions

| Function | Rules |
|---|---|
| `listBestSellingThemes(limit: number): Promise<ThemeCardDTO[]>` | published themes, `stats.salesCount` descending then `publishedAt` descending (D-114): `themeRepository.findThemes({ status: "published" }, "best", 1, limit)` and the private `toCards`. |
| `listPublishedThemeSlugs(): Promise<string[]>` | slugs of all published themes (newest published first). Repository `findPublishedThemeSlugs` selects only `slug`. |

### Service (`account.service.ts`)

| Function | Rules |
|---|---|
| `getAccountOverview(userId): Promise<AccountOverviewDTO>` | `ownedCount`: `countActiveOwnershipsByUser([userId])` (0 when missing from the map). `unreadCount` and `latestNotifications`: the T-014 functions (19-F). `bestSellers`: `listBestSellingThemes(4)`. `openWalletPayments`: read the user with `userRepository.findUserById`; country not `"EG"` → `null`; otherwise count the user's wallet payments (`listWalletPaymentsForUser`) whose status is `awaiting_payment` or `submitted`. All independent reads run in parallel. |

### Page `/account` (replaces the temporary page)

`requireUser("/account")`. `metadata`: title `Account · Theme Store`, `robots: { index: false }`. Inside `Stack gap="lg"`:
1. Heading level 1 `Hi <name>`. **The overview heading:** 05 gives no title for this page; keep `Hi <name>` because `e2e/auth.spec.ts` (T-003) looks for the text `Hi <name>` after logging in, and that file must not change.
2. When `!user.emailVerified`: `Alert tone="warning"` with the text `Please confirm your email address.` followed by `TextLink` "Confirm email" → `/verify-email` (same markup as the temporary page).
3. A `Grid columns={3}` of stat `Card`s (label in `Text tone="muted"`, number in `Text size="lg" weight="bold"`): "Themes owned" (`ownedCount`), "Unread notifications" (`unreadCount`), and — only when `openWalletPayments !== null` — "Wallet payments waiting" (`openWalletPayments`).
4. Section Heading level 2 "Latest notifications" and `TextLink` "See all" → `/account/notifications`; list of up to 5 notifications: title (`Text weight="bold"`), body (`Text size="sm" tone="muted"`), `formatDate(createdAt)`, `Badge` "New" when unread. Empty: Text `No notifications yet.`
5. Section Heading level 2 "Best sellers": `Grid columns={4}` of `ThemeCard` (hidden when the list is empty).
6. Only for users in Egypt (`openWalletPayments !== null`): `Card` with Heading level 3 `Pay with Vodafone Cash or InstaPay` and a Text explaining that the wallet option is on every checkout page. Text: **[PLANNER 19-E]** the docs name only the card title and say "explaining the wallet option is on each checkout page". Recommended: `"You can pay with an Egyptian wallet on every checkout page. Choose “Egyptian wallet”, send the amount, then upload a screenshot of the transfer."`

---

## Part 2 — Account settings

### Texts (`account.messages.ts`)

```ts
export const ACCOUNT_MESSAGES = {
  saved: "[PLANNER 19-C]",                      // recommended "Saved." (same word as T-004)
  passwordChanged: "Your password was changed.", // 05 §4, word for word
  passwordFormSubmit: "Change password",
  emailNotificationsTitle: "Email notifications",
  deleteAccount: "To delete your account, email",   // followed by the support email and "."
} as const;
```
`auth.messages.ts` gets `wrongCurrentPassword: "[PLANNER 19-C]"` (recommended `"Your current password is wrong."`).

**[PLANNER 19-C]** Texts the docs do not give: success text of the profile form and of the e-mail switches (recommended `"Saved."`), the error when the current password is wrong (recommended `"Your current password is wrong."`, also used by the schema for an empty current password), the submit text of the profile form (recommended `"Save changes"`; the password form uses `"Change password"`, the e-mail form `"Save"` as in 05 §4).

### Auth service additions (`auth.service.ts`)

Same style as the existing functions (the file's own exception to the layer rule: it calls `auth.api.*`; `readErrorCode`, `hasStatusCode` are already in the file; no `next/*`).

| Function | Does | Errors |
|---|---|---|
| `updateUserName(name: string, headers: Headers): Promise<void>` | `auth.api.updateUser({ body: { name }, headers })` | any Better Auth error → `console.error("updateUserName failed", error)` and `AppError("INVALID", AUTH_MESSAGES.generic)` |
| `changeUserPassword(input: { currentPassword: string; newPassword: string }, headers: Headers): Promise<void>` | `auth.api.changePassword({ body: { currentPassword, newPassword, revokeOtherSessions: true }, headers })` | error code containing `INVALID_PASSWORD` → `AppError("INVALID", AUTH_MESSAGES.wrongCurrentPassword)`; status 429 → `AppError("RATE_LIMITED", AUTH_MESSAGES.tooManyAttempts)`; anything else → log + `AppError("INVALID", AUTH_MESSAGES.generic)` |

The password and the name are never logged. If an option name above does not exist in better-auth 1.7.17's types, stop and write a question in `docs/QUESTIONS.md` (do not guess another).

### Test helper (`src/shared/test/session-headers.ts`)

`createSessionHeaders(email: string, password: string): Promise<Headers>` — signs the user in with Better Auth and returns request headers that carry the session cookie, so tests can call functions that need a logged-in user:
`const { headers: responseHeaders } = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true })`; take `responseHeaders.getSetCookie()`, keep for each entry the part before the first `;` (`name=value`), join the parts with `"; "` and return `new Headers({ cookie: <joined> })`. Used only by tests (like `createUser`, it is allowed to import from `features/`).
Each call creates a new session. If `returnHeaders` is not accepted by `signInEmail` in better-auth 1.7.17, stop and write a question in `docs/QUESTIONS.md`.

### Repository additions (`user.repository.ts`)

| Function | Does |
|---|---|
| `setEmailPreferences(id, preferences)` | `$set` of exactly `emailOwnedThemeUpdates`, `emailFavoriteThemeUpdates`, `emailFollowedCategoryThemes`, `emailAnnouncements` (booleans) — our extra fields only (03 §3) |
| `hasCredentialAccount(id): Promise<boolean>` | `mongoose.connection.collection("account").countDocuments({ userId: toObjectId(id), providerId: "credential" }) > 0` (Better Auth's collection; 03 §3: reference fields are ObjectId — if the test shows the `userId` is stored as text, write a question) |

### Schemas (`account.schemas.ts`)

Messages come from `AUTH_MESSAGES` (same ones as `registerSchema` and `resetPasswordSchema`):
- `profileSchema { name, country }`: `name` trim 2–80 (`invalidName`); `country` refine `isCountryCode` (`invalidCountry`).
- `changePasswordSchema { currentPassword, newPassword, confirmPassword }`: `currentPassword` min 1 (`wrongCurrentPassword`) and max 128; `newPassword` 8–128 (`invalidPassword`); refine `newPassword === confirmPassword`, error on `confirmPassword` with `passwordsDiffer`.
- `emailPreferencesSchema { emailOwnedThemeUpdates, emailFavoriteThemeUpdates, emailFollowedCategoryThemes, emailAnnouncements }`: four booleans.

### Service (`account.service.ts`) — settings part

| Function | Rules |
|---|---|
| `getAccountSettings(userId): Promise<AccountSettingsDTO \| null>` | `null` for an unknown user. DTO: `{ name, email, country: string \| null, hasPassword: boolean, emailOwnedThemeUpdates, emailFavoriteThemeUpdates, emailFollowedCategoryThemes, emailAnnouncements }`. `hasPassword` = `hasCredentialAccount(userId)`. |
| `updateProfile(userId, input: ProfileInput, headers: Headers): Promise<void>` | **First** `setUserCountry(userId, input.country)` (an unknown code throws INVALID `"Please choose your country."` before anything is written), **then** `updateUserName(input.name, headers)`. The e-mail is never changed here. |
| `changePassword(input: ChangePasswordInput, headers: Headers): Promise<void>` | `changeUserPassword({ currentPassword, newPassword }, headers)` |
| `updateEmailPreferences(userId, input: EmailPreferencesInput): Promise<void>` | `setEmailPreferences`; nothing else is written. |

### Actions (`account.actions.ts`)

All three: `(previous: ActionResult | null, formData: FormData) => Promise<ActionResult>`; 02 §5.5 order with `requireUser("/account/settings")` first; revalidate `/account/settings` and `/account`.
- `updateProfileAction`: values `{ name, country }`; `updateProfile(user.id, parsed.data, await headers())`; result `{ ok: true, data: undefined, message: ACCOUNT_MESSAGES.saved }`.
- `changePasswordAction`: **no values are sent back** (`{}` — passwords are never echoed); `changePassword(parsed.data, await headers())`; result message `ACCOUNT_MESSAGES.passwordChanged`. The user stays logged in (Better Auth keeps the current session, other sessions are revoked).
- `updateEmailPreferencesAction`: four `readCheckbox` values (field names equal the four user field names); `updateEmailPreferences(user.id, parsed.data)`; message `ACCOUNT_MESSAGES.saved`.
Use `validationFailure`, `failureFrom` like `auth.actions.ts`.

### Page `/account/settings`

`requireUser("/account/settings")`, `getAccountSettings(user.id)` (`null` → `notFound()`). `metadata`: title `Settings · Theme Store`, `robots: { index: false }`. Heading level 1 "Settings". Four `Card`s in a `Stack gap="lg"`, each with its own Heading level 2 and its own form (05 §4):
1. **Profile** (`ProfileForm`): `TextField` "Name", `SelectField` "Country" (options `getCountryOptions()`, `defaultValue` = current country, placeholder "Choose your country"), the e-mail shown read-only as `Text` `Email: <email>`, `SubmitButton` "Save changes" (19-C) / `"Saving…"`; success `Alert` with the message.
2. **Password** (`PasswordForm`) — rendered **only when `hasPassword`**: `TextField type="password"` "Current password" (`autoComplete="current-password"`), "New password" (`autoComplete="new-password"`, hint `"At least 8 characters."`), "Confirm password"; `SubmitButton` "Change password" / `"Saving…"`; success `Alert` `Your password was changed.`.
3. **Email notifications** (`EmailPreferencesForm`): four `CheckboxField`s with exactly these labels — "New versions of themes I own", "New versions of themes I favorited", "New themes in categories I follow", "Announcements from the store" — one `SubmitButton` "Save" / `"Saving…"`. Payment and feedback-reply e-mails are not listed (they cannot be turned off, 00 §3.7).
4. **Delete account** (`DeleteAccountCard`, prop `supportEmail` = `env.SUPPORT_EMAIL`, read in the page): `Text` `To delete your account, email <supportEmail>.`

Forms use `useActionState(action, null)`, `FormError`, `submittedValue` / `formKey` where values are sent back (not for the password form).

---

## Part 3 — Info pages and contact

### Content feature

`content.constants.ts`:
```ts
export const INFO_PAGES = [
  { slug: "about", title: "About" },
  { slug: "terms", title: "Terms of Service" },
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "refund-policy", title: "Refund Policy" },
  { slug: "license", title: "License" },
] as const;                                  // titles: 00 §5
export type InfoPageSlug = (typeof INFO_PAGES)[number]["slug"];
```
`content.repository.ts`: `readContentFile(slug: InfoPageSlug): Promise<string | null>` — reads `path.join(process.cwd(), "src", "content", `${slug}.md`)` as UTF-8 text; a missing file gives `null`. (This is the only file that uses `node:fs`.)
`content.service.ts`: `getInfoPage(slug: string): Promise<InfoPageDTO | null>`; a slug that is not in `INFO_PAGES` gives `null` **without reading any file** (so `"../../package"` can never read anything); a missing file gives `null`; otherwise `{ slug, title, markdown }` (`InfoPageDTO` in `content.types.ts`).
`components/InfoPage.tsx`: props `{ page: InfoPageDTO }` → `PageContainer width="narrow"`, `Stack gap="lg"`, `Heading level={1}` = title, `MarkdownText` = markdown.

**[PLANNER 19-B]** `docs/02-architecture.md` section 2 has no feature folder for static texts. This task creates `src/features/content/`. Planner: confirm or name another place.

**[PLANNER 19-D]** `05-pages.md` says "the task creates each file with a short placeholder paragraph and the heading". `MarkdownText` shows markdown headings as level 3 (the page already has its h1), so the page renders the h1 from `INFO_PAGES` and each `.md` file contains **only the placeholder paragraph**. Recommended paragraph text (owner replaces it): `This page will be written by the owner.` Confirm or replace.

Files `src/content/<slug>.md`: exactly the paragraph above followed by a newline.

### Pages

Five pages `src/app/<slug>/page.tsx`, same shape (example `about`):
```tsx
export async function generateMetadata(): Promise<Metadata> { return { title: "About · Theme Store" }; }
export default async function AboutPage() {
  const page = await getInfoPage("about");
  if (!page) notFound();
  return <InfoPage page={page} />;
}
```
Titles `"<title> · Theme Store"` from `INFO_PAGES`.

**`/contact`** — no data service; `env.SUPPORT_EMAIL`. `metadata` title `Contact · Theme Store`. `PageContainer width="narrow"`, Heading level 1 "Contact", and
`<Text>Questions before or after buying? Email us at <TextLink href={"mailto:" + SUPPORT_EMAIL}>{SUPPORT_EMAIL}</TextLink> and we usually reply within 1–2 business days.</Text>`.
When logged in (`getCurrentUser()` not null) also `TextLink` "Send feedback" → `/account/feedback`.

---

## Part 4 — Demo preview

### Layout without the store header

**[PLANNER 19-A]** `app/layout.tsx` renders `StoreHeader` and `StoreFooter` around every page, and a nested layout cannot remove them, so "a page without store header/footer" (05 §3) cannot be done with `preview/layout.tsx` alone.
Recommended (written below): the preview layout covers the whole window with a fixed, full-screen box (`FullScreenFrame`, `fixed inset-0 z-50`, page background), which hides the header and footer underneath. Known limit: the hidden header links are still in the page for keyboard and screen-reader users.
Alternative: move every store, account, admin and auth page into a `(store)` route group that owns the header/footer (a large move of existing files).

- `shared/layout/FullScreenFrame.tsx`: props `{ children }` → `<div className="fixed inset-0 z-50 flex flex-col bg-background">{children}</div>`.
- `shared/layout/PreviewBar.tsx`: props `{ children }` → `<div className="border-border bg-background border-b px-4 py-2">{children}</div>` (the thin top bar).
- `shared/ui/EmbedFrame.tsx`: props `{ src: string; title: string; width: "desktop" | "tablet" | "mobile" }` → `<iframe src title className=… />` with literal classes per width: desktop `w-full`, tablet `w-[768px] max-w-full`, mobile `w-[375px] max-w-full`, plus the shared `mx-auto h-full bg-surface border-0` (use a `const` map of literal strings, no template strings).
- `app/themes/[slug]/preview/layout.tsx`: `export default function PreviewLayout({ children }) { return <FullScreenFrame>{children}</FullScreenFrame>; }`.

### Page `/themes/[slug]/preview`

`getPublishedThemeBySlug(slug)`; `null` or `demoUrl === null` → `notFound()`. `generateMetadata`: title `<theme name> live demo · Theme Store`.
Renders `DemoPreview` (`"use client"`, props `themeName`, `themeSlug`, `priceCents`, `demoUrl`):
- `PreviewBar` with an `Inline justify="between" wrap`: `TextLink` `← <name>` → `/themes/<slug>`; `Text` price (`formatPrice(priceCents, "usd")`); device switch = three `Button size="sm"` "Desktop", "Tablet", "Mobile" (state `"desktop" | "tablet" | "mobile"`, default desktop; the selected one `variant="primary"`, the others `"secondary"`); `ButtonLink size="sm"` "Buy now" → `/checkout/<slug>`.
- Under the bar, `<div className="min-h-0 flex-1">` containing `EmbedFrame` with `src={demoUrl}`, `title={`${themeName} live demo`}`, `width` = the selected device. (The frame area fills the rest of the window.)

### "Live demo" button (`ThemeDetail.tsx`)

Replace the `ButtonAnchor` "Live demo" (T-004: it linked straight to `demoUrl`) with `ButtonLink variant="secondary"` → `/themes/${theme.slug}/preview`, still shown only when `demoUrl` is set. Remove the `ButtonAnchor` import only if nothing else in the file uses it. Change nothing else in the file.

---

## Part 5 — SEO files

`src/app/sitemap.ts`: `export const dynamic = "force-dynamic";` (it reads the database, and `pnpm build` runs in CI without one) and
`export default async function sitemap(): Promise<MetadataRoute.Sitemap>` returning, in this order, objects `{ url }` (no other fields) with `env.APP_URL` as base:
`/`, `/themes`, one `/categories/<slug>` for every category (`listCategoriesWithPublishedCounts()`, all categories, also empty ones), one `/themes/<slug>` for every published theme (`listPublishedThemeSlugs()`), then `/about`, `/terms`, `/privacy`, `/refund-policy`, `/license`, `/contact` (the 6 info pages).
`src/app/robots.ts`: `export default function robots(): MetadataRoute.Robots` → `{ rules: { userAgent: "*", allow: "/", disallow: ["/account", "/admin", "/checkout", "/api"] }, sitemap: `${env.APP_URL}/sitemap.xml` }` (05 §3).
Theme pages already have `generateMetadata` (T-004): do not change it.

---

## Required tests

`auth.service.test.ts` (add; real Better Auth; sessions made with `createSessionHeaders(email, password)` after `registerUser`)
- [ ] updateUserName › changes the name through Better Auth → `UserModel` name is `"New Name"`; email unchanged
- [ ] changeUserPassword › changes the password and revokes the other sessions → two sessions (two `createSessionHeaders` calls); after the call with the first headers: `loginUser` with the new password creates a session; `loginUser` with the old password rejects INVALID `wrongCredentials`; `auth.api.getSession({ headers: <second headers> })` is `null`; exactly 1 `session` document left for the user (`mongoose.connection.collection("session")`)
- [ ] changeUserPassword › refuses a wrong current password → AppError INVALID with the 19-C `wrongCurrentPassword` text; the old password still logs in

`account.service.test.ts` (real in-memory MongoDB)
- [ ] getAccountSettings › returns profile, the four switches and `hasPassword` → a user made with `registerUser` has `hasPassword true`; a user made with `createUser` (no `account` document) has `false`; switches default `true`; `null` for an unknown id
- [ ] updateProfile › saves the country and the name → `country "US"` and the new name in the database (headers from `createSessionHeaders`)
- [ ] updateProfile › refuses an unknown country and writes nothing → INVALID `"Please choose your country."`; name and country unchanged
- [ ] updateEmailPreferences › saves the four switches and nothing else → set all four to `false`: user has the four `false`; `name`, `email`, `country`, `disabled` unchanged
- [ ] getAccountOverview › counts owned themes and unread notifications and returns the latest 5 → 1 active + 1 revoked ownership gives `ownedCount 1`; 3 unread + 4 read notifications give `unreadCount 3`; 7 notifications give 5 items, newest first
- [ ] getAccountOverview › returns the 4 best-selling published themes → 5 published themes with different `salesCount` plus a draft with the highest: the 4 best published ones in order, no draft
- [ ] getAccountOverview › reports open wallet payments only for Egypt → a user with country `"US"` gets `null`; a user with country `"EG"` and wallet payments in `awaiting_payment`, `submitted`, `approved`, `rejected`, `cancelled` gets `2`

`account.schemas.test.ts`
- [ ] profileSchema › refuses a 1-character name and country `"XX"` with `invalidName` / `invalidCountry`
- [ ] changePasswordSchema › refuses a short new password and different passwords → `invalidPassword` on `newPassword`; `passwordsDiffer` on `confirmPassword`; an empty current password gets `wrongCurrentPassword`

`content.service.test.ts`
- [ ] getInfoPage › returns title and markdown of each of the 5 pages → `getInfoPage("about")` has `title "About"` and non-empty `markdown`; `"refund-policy"` has `title "Refund Policy"`
- [ ] getInfoPage › returns null for an unknown slug and never reads outside the content folder → `"nope"` and `"../../package"` give `null`

`theme.service.test.ts` (add)
- [ ] listBestSellingThemes › returns published themes by sales and respects the limit → 5 themes (`salesCount` 1…5), a draft with 99: `limit 4` returns the published ones with 5, 4, 3, 2
- [ ] listPublishedThemeSlugs › returns only published slugs → draft and unpublished excluded

`sitemap.test.ts` / `robots.test.ts` (`src/app/`; call the default export)
- [ ] sitemap › lists the pages, categories and published themes with absolute URLs → contains `http://localhost:3000/`, `/themes`, the category and the published theme URLs and the 6 info pages (`/about` … `/contact`); a draft theme's URL is absent
- [ ] robots › disallows the private areas and names the sitemap → rules disallow `/account`, `/admin`, `/checkout`, `/api`; `sitemap` is `http://localhost:3000/sitemap.xml`

`e2e/account.spec.ts` (style of `e2e/catalog.spec.ts`: `RUN_ID`, `registerAs` with country EG)
- [ ] the overview shows the stats and the Egypt card → after registering and opening `/account`: heading `Hi E2E Person`, texts "Themes owned", "Unread notifications", "Wallet payments waiting", `Pay with Vodafone Cash or InstaPay`, and the warning `Please confirm your email address.`
- [ ] the customer changes name, e-mail switches and password in the settings → on `/account/settings`: fill "Name" with `Renamed ${RUN_ID}`, click "Save changes" → the 19-C saved text is visible; reload → the field holds the new name; uncheck "Announcements from the store", click "Save" → saved text; reload → the checkbox is unchecked; password form with a wrong "Current password" shows the 19-C error text; with the right one (and a new password twice) shows `Your password was changed.`; log out, log in with the new password → `/account` shows `Hi Renamed ${RUN_ID}`. React resets forms after a server action: fill fields again after an error.

`e2e/storefront.spec.ts` (flow 1 of `docs/10-testing.md` section 8; seeds like `e2e/catalog.spec.ts`: 2 categories, 2 published themes — one in each — the first with `demoUrl "https://example.com/demo"`; cleaned in `afterAll`)
- [ ] a visitor filters by category, opens a theme and its live demo → `/themes`, choose the first category in "Category", click "Apply" → only the first theme's card is visible; open it; click "Live demo" → URL ends with `/preview`; the top bar shows `← <theme name>`, the price and the link "Buy now"; the frame with title `<theme name> live demo` is visible; clicking "Mobile" makes the frame 375 px wide (`boundingBox().width`), clicking "Tablet" 768 px
- [ ] a theme without a demo URL has no preview → `/themes/<second slug>/preview` shows "Page not found"; its page has no "Live demo" link
- [ ] the info pages, contact, robots and sitemap work → `/about` has heading "About"; `/terms` heading "Terms of Service"; `/contact` shows `support@example.com` as a link whose `href` is `mailto:support@example.com`; `GET /robots.txt` contains `Disallow: /admin` and `Sitemap:`; `GET /sitemap.xml` contains `/themes/<first slug>` and `/about`

Break check (≥ 3): remove `revokeOtherSessions: true`; remove the `INFO_PAGES` check in `getInfoPage`; make `listPublishedThemeSlugs` return draft themes; make `openWalletPayments` ignore the country.

## Do NOT

- Do not change `e2e/auth.spec.ts` or any other existing test; do not change T-003's login or register code.
- Do not change a user's e-mail. Do not write Better Auth core fields with Mongoose (`name` goes through `auth.api.updateUser`, the password through `auth.api.changePassword`).
- Do not echo passwords in `values` of an action result. Do not log passwords, names or tokens.
- Do not add env variables, fields, pages or routes that are not listed. Do not write real legal text.
- Do not read files outside `src/content/`. Do not use `dangerouslySetInnerHTML` (`MarkdownText` shows the files).
- Feature components and pages: layout classes only (`pnpm check:styles`); the iframe classes live in `EmbedFrame`, the fixed box in `FullScreenFrame`.
- No `any`, no `@ts-ignore`, no `eslint-disable`.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-019: account pages, info pages and SEO`
