# T-009: Ownerships and downloads — "My themes", download route, AccountShell

- Depends on: T-008
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2–7, 9, 13; `docs/03-data-model.md` sections 1, 8, 17, 19 ("Admin grants / revokes", "Customer downloads");
  `docs/07-delivery-updates.md` sections 5, 7, 11 (`download.service.test.ts`); `docs/05-pages.md` sections 1 and 4 (AccountShell, `/account/themes`);
  `docs/01-decisions.md` D-004, D-011, D-014, D-016, D-034, D-049, D-057, D-122; `docs/06-payments.md` section 11 (only the ownership lines, for context);
  `docs/10-testing.md`. Copy `src/features/themes` and `src/features/versions` (T-004, T-008).

Sections that contain `[PLANNER: ...]` are **not decided yet**. Build everything else, do not guess the marked part,
and add the question to `docs/QUESTIONS.md` (AGENTS.md rule).

## Goal

"Who may download which theme" (ownerships) with every rule of 03 §8, the download link service and its route (rate limit, download
log, short-lived signed link), the account frame `AccountShell`, and the page `/account/themes` where customers download their themes.

**Not in this task** (later tasks call or extend these files):
- Orders, checkout, webhooks, refunds: they will call `grantFromOrder` and `revokeForRefund` (T-012, T-018). No order model here.
- Admin pages for granting and removing a theme, and the customer page (T-017). Here only the **service functions** exist.
- The other account pages (`/account/orders`, favorites, notifications, feedback, settings) and the new `/account` overview (T-012 – T-019).
  `AccountShell` lists their links even though the pages do not exist yet (like `AdminShell`). The unread-notifications badge is added with the notification center (T-014).
- The download button on the theme page, the checkout success page and the wallet page (later tasks reuse `DownloadButton`).
- The admin "top themes by downloads" numbers (T-018).

## Files

```
src/features/ownerships/
  ownership.model.ts / ownership.repository.ts / ownership.service.ts
  ownership.types.ts / ownership.constants.ts
  ownership.service.test.ts / ownership.model.test.ts
  components/OwnedThemeCard.tsx

src/features/downloads/
  download-log.model.ts / download-log.repository.ts
  download.service.ts / download.constants.ts / download.schemas.ts
  download.service.test.ts / download.schemas.test.ts
  components/DownloadButton.tsx

src/features/themes/theme.types.ts       (change) add ThemeSummaryDTO
src/features/themes/theme.mapper.ts      (change) add toThemeSummaryDTO
src/features/themes/theme.repository.ts  (change) add findThemesByIds, incrementThemeDownloadCount
src/features/themes/theme.service.ts     (change) add listThemeSummariesByIds, incrementDownloadCount
src/features/themes/theme.service.test.ts (change) append the 2 tests listed below; do not touch the existing tests

src/shared/layout/AccountShell.tsx
src/shared/layout/AccountNav.tsx         ("use client", highlights the current page)
src/shared/test/factories.ts             (change) add createOwnership(userId, themeId, overrides?)

src/app/account/layout.tsx               AccountShell around every /account page
src/app/account/themes/page.tsx
src/app/api/downloads/[versionId]/route.ts   (the complete file is in this task: copy it exactly)

e2e/helpers.ts                           (change) add putStoredFile (below)
e2e/downloads.spec.ts
```

## Packages

None.

## Ownership model (`ownership.model.ts`)

Exactly 03 §8: collection `"ownerships"`, `{ timestamps: true }`, model name `"Ownership"`, export `OwnershipModel`, `OwnershipRecord`, every field commented, in this order:
`userId` (ObjectId `ref: "User"`, required), `themeId` (`ref: "Theme"`, required), `status` (enum, required), `source` (enum, required), `orderId` (`ref: "Order"`, default `null`),
`grantedByUserId` (`ref: "User"`, default `null`), `grantNote` (string, default `null`, trimmed, max 300), `licenseType` (enum, required, default `"standard"`),
`revokedAt` (Date, default `null`), `revokedReason` (enum `"refund" | "admin"`, default `null`), `revokedByUserId` (`ref: "User"`, default `null`), `revokeNote` (string, default `null`, trimmed, max 300).
Indexes (03 §8), in this order: `{ userId: 1, themeId: 1 }` **unique**; `{ themeId: 1, status: 1, _id: 1 }`; `{ userId: 1, status: 1 }`.

Required-by-value rules of 03 §8, written as ONE `pre("validate")` hook (plain function **without** `next`; read values with `this.get("<path>")`;
report each missing value with `this.invalidate("<path>", "Path `<path>` is required.")`):
`orderId` when `source` is `"purchase"`; `grantedByUserId` when `source` is `"admin_grant"`; `revokedByUserId` and `revokeNote` when `revokedReason` is `"admin"`.

Constants (`ownership.constants.ts`): `OWNERSHIP_STATUSES = ["active", "revoked"]`, `OWNERSHIP_SOURCES = ["purchase", "admin_grant"]`, `LICENSE_TYPES = ["standard"]`,
`REVOKE_REASONS = ["refund", "admin"]`, `OWNERSHIP_NOTE_MAX = 300`; export their types (03 §1.7).

## Ownership service (`ownership.service.ts`)

Repository functions (each calls `connectDB()`; writes take an optional last `session?: ClientSession`; invalid ids give `null` / `false` / `[]`, never an error):
`findOwnershipByUserAndTheme(userId, themeId, session?)`, `existsActiveOwnership(userId, themeId)`, `findActiveOwnershipsByUserId(userId)`, `insertOwnership(fields, session?)`,
`activateOwnershipById(id, fields, session?)` (sets `status "active"`, the new `source`, `orderId`, `grantedByUserId`, `grantNote` and sets `revokedAt`, `revokedReason`, `revokedByUserId`, `revokeNote` to `null`),
`revokeOwnershipById(id, fields, session?)` (sets `status "revoked"`, `revokedAt`, `revokedReason`, `revokedByUserId`, `revokeNote`; the filter also requires `status "active"`; returns whether a row changed).
`licenseType` is always `"standard"` (D-006). `revokedAt` is always `now()`.

| Function | Rules / errors |
|---|---|
| `hasActiveOwnership(userId, themeId): Promise<boolean>` | `true` only when an `active` ownership exists. Invalid ids → `false`. This is the **only** access rule for downloads (works for unpublished themes too, D-016). |
| `grantFromOrder({ userId, themeId, orderId }, session?): Promise<"created" \| "reactivated" \| "unchanged">` | 03 §8: no ownership → insert (`status "active"`, `source "purchase"`, `orderId`, `grantedByUserId null`, `grantNote null`, `revoked*` `null`) → `"created"`. A **revoked** ownership → update that **same document** (`status "active"`, `source "purchase"`, new `orderId`, `grantedByUserId null`, `grantNote null`, all `revoked*` `null`) → `"reactivated"`. An already `active` ownership → change nothing → `"unchanged"`. |
| `revokeForRefund({ userId, themeId, orderId }, session?): Promise<boolean>` | Revokes the `active` ownership of this user and theme **only if its `orderId` is this order** (D-011, D-014): `revokedReason "refund"`, `revokedByUserId null`, `revokeNote null`. Returns `true` when it revoked, `false` when nothing matched (other order, admin grant, already revoked, none). |
| `grantByAdmin({ userId, themeId, note }, adminUserId): Promise<void>` | See "Admin grant and revoke". |
| `revokeByAdmin({ userId, themeId, note }, adminUserId): Promise<void>` | See "Admin grant and revoke". |
| `listOwnedThemes(userId): Promise<OwnedThemeDTO[]>` | The user's `active` ownerships → `listThemeSummariesByIds` (themes service) for their themes → `listVersionsForTheme(themeId)` (versions service, newest first) for each. Result sorted by theme name (`localeCompare` with locale `"en"`). Ownerships of themes in **any** status are listed. A theme whose id no longer exists is left out. A theme without versions has `versions: []`. |

`OwnedThemeDTO = { theme: ThemeSummaryDTO; versions: VersionDTO[] }` (`VersionDTO` from `version.types.ts`). There is no mapper: the service only combines two DTOs.
The service calls other features only through their services (D-087): themes (`listThemeSummariesByIds`), versions (`listVersionsForTheme`), activity (`activityService.log`).

### Admin grant and revoke

`[PLANNER: 03 §8 gives the two refusal messages but not their error codes, and 03 §19 says to log ownership_granted / ownership_revoked without giving the summary sentences. Also undecided: whether these two functions must check that the theme and the customer exist (and with which messages). Build everything else in this task, but do not build grantByAdmin and revokeByAdmin until this block is decided.]`

Already decided (03 §8, §19), for whoever builds them after the decision:
- `grantByAdmin`: when an `active` ownership exists → refused with the message `"This customer already owns this theme."`. Otherwise **one transaction**: insert or re-activate the ownership
  (`source "admin_grant"`, `grantedByUserId` = the admin, `grantNote` = `note` or `null`; re-activation updates the same document and nulls `revoked*`), then `activityService.log({ action: "ownership_granted", actorRole: "admin", actorUserId: adminUserId, subjectUserId: userId, targetType: "theme", targetId: themeId, summary: <PLANNER> }, session)`.
- `revokeByAdmin`: when the ownership does not exist or is already `revoked` → refused with `"This customer does not own this theme."`. Otherwise **one transaction**: revoke with `revokedReason "admin"`, `revokedByUserId` = the admin, `revokeNote` = `note` (required, 1–300 characters, validated by the T-017 form), then log `ownership_revoked` (same fields, `summary: <PLANNER>`).
- `note` of `grantByAdmin` is `string | null`; `note` of `revokeByAdmin` is `string`.

## Themes feature changes

- `theme.types.ts`: `ThemeSummaryDTO = { id: string; name: string; slug: string; status: ThemeStatus; coverImage: ThemeImageDTO | null }`. `theme.mapper.ts`: `toThemeSummaryDTO(theme)` (cover = first image or `null`, URL via `publicImageUrl`).
- `theme.repository.ts`: `findThemesByIds(ids: string[])` (invalid ids ignored), `incrementThemeDownloadCount(themeId): Promise<boolean>` (`$inc: { "stats.downloadCount": 1 }`, returns whether a theme matched).
- `theme.service.ts`: `listThemeSummariesByIds(themeIds: string[]): Promise<ThemeSummaryDTO[]>` (unknown ids are left out) and `incrementDownloadCount(themeId): Promise<void>` (unknown theme → NOT_FOUND `"Theme not found."`).

## Download log (`download-log.model.ts`, `download-log.repository.ts`)

Model exactly 03 §17: collection `"downloadLogs"`, `{ timestamps: true }`, export `DownloadLogModel`; fields `userId` (`ref: "User"`), `themeId` (`ref: "Theme"`), `versionId` (`ref: "Version"`), all required ObjectId, commented.
Indexes: `{ userId: 1, createdAt: -1 }`, `{ themeId: 1, createdAt: -1 }`.
Repository: `insertDownloadLog({ userId, themeId, versionId, createdAt })` — the service passes `createdAt: now()` so the clock rule of `10 §2.11` works (Mongoose keeps a given `createdAt`);
`countDownloadLogsForUserSince(userId, since: Date): Promise<number>` counts rows of that user with `createdAt` **greater than** `since`.

## Download service (`download.service.ts`, `download.constants.ts`)

Constants: `DOWNLOADS_PER_HOUR = 30`, `DOWNLOAD_WINDOW_MINUTES = 60`, `DOWNLOAD_LINK_SECONDS = 300`, plus (07 §7.2, values exactly as written there):

```ts
export const DOWNLOAD_ERROR_KEYS = ["not_found", "not_owned", "rate_limited", "failed"] as const;
export type DownloadErrorKey = (typeof DOWNLOAD_ERROR_KEYS)[number];
export const DOWNLOAD_ERROR_PARAMS: Record<AppErrorCode, DownloadErrorKey> = {
  NOT_FOUND: "not_found", FORBIDDEN: "not_owned", RATE_LIMITED: "rate_limited", CONFLICT: "failed", INVALID: "failed",
};
export const DOWNLOAD_ERROR_MESSAGES: Record<DownloadErrorKey, string> = {
  not_found: "This file does not exist.",
  not_owned: "You do not own this theme.",
  rate_limited: "You downloaded too many files in the last hour. Please try again later.",
  failed: "The download could not start. Please try again.",
};
```
(`import type { AppErrorCode } from "@/shared/errors"`.)

`createDownloadLink({ userId, versionId }): Promise<{ url: string }>` — no transaction (03 §19). Steps, in this order (07 §7.1):

| # | Step | Error |
|---|---|---|
| 1 | `getVersionForDownload(versionId)` (versions service) returns a version (an invalid id gives `null`) | NOT_FOUND `"This file does not exist."` |
| 2 | `hasActiveOwnership(userId, version.themeId)` is `true` | FORBIDDEN `"You do not own this theme."` |
| 3 | `countDownloadLogsForUserSince(userId, now() − 60 minutes)` < 30 | RATE_LIMITED `"You downloaded too many files in the last hour. Please try again later."` |
| 4 | `insertDownloadLog({ userId, themeId, versionId, createdAt: now() })`, then themes service `incrementDownloadCount(themeId)` | — |
| 5 | slug from `getThemeForAdmin(themeId)` (themes service); return `{ url: await createDownloadUrl({ key: version.fileKey, expiresInSeconds: 300, downloadFileName: "<slug>-<version>.zip" }) }` | — |

Admins are **not** an exception (07 §7.1). The message strings are read from `DOWNLOAD_ERROR_MESSAGES` (do not write them twice).

`download.schemas.ts`: `downloadErrorSearchParamsSchema` = `z.object({ downloadError: z.enum(DOWNLOAD_ERROR_KEYS).optional().catch(undefined) })`
(an unknown value, even `"constructor"`, gives `undefined`: 07 §7.2 "ignores any other value").

## Route `src/app/api/downloads/[versionId]/route.ts`

Copy exactly (07 §7.2):

```ts
import { getCurrentUser } from "@/features/auth/session";
import { createDownloadLink } from "@/features/downloads/download.service";
import { DOWNLOAD_ERROR_PARAMS } from "@/features/downloads/download.constants";
import { AppError } from "@/shared/errors";
import { env } from "@/shared/config/env";

function redirectTo(path: string): Response {
  return Response.redirect(new URL(path, env.APP_URL), 302);
}

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const user = await getCurrentUser();
  if (!user) return redirectTo("/login?next=%2Faccount%2Fthemes");
  try {
    const { url } = await createDownloadLink({ userId: user.id, versionId });
    return Response.redirect(url, 302);
  } catch (err) {
    if (err instanceof AppError) return redirectTo(`/account/themes?downloadError=${DOWNLOAD_ERROR_PARAMS[err.code]}`);
    console.error("download failed", err);
    return redirectTo("/account/themes?downloadError=failed");
  }
}
```
The route has no unit test (07 §11); the e2e test covers it.

## `DownloadButton`

`DownloadButton({ versionId, label, size?, variant? })` renders `ButtonAnchor` (UI kit) with `href={`/api/downloads/${versionId}`}` and `rel="nofollow"`.
**Never** `next/link` (a prefetch would count as a download). No `"use client"`. Emails never link to this route.

## AccountShell and pages

`AccountShell({ isAdmin, children })` (`shared/layout`, same frame classes as `AdminShell`): the menu (`AccountNav`) next to the page content (`<div className="min-w-0 flex-1">`).
`AccountNav` (`"use client"`, `usePathname`): `<nav aria-label="Account">` with the links of 05 §4, in this order: "Overview" `/account`, "My themes" `/account/themes`, "Orders" `/account/orders`,
"Favorites" `/account/favorites`, "Notifications" `/account/notifications`, "Feedback" `/account/feedback`, "Settings" `/account/settings`; `next/link` links with visual classes (allowed in `shared/layout`):
the current page (`pathname` equals the href; for `/account` only an exact match) is highlighted and has `aria-current="page"`, the others are muted. On small screens the menu is a horizontal scroll row above the content
(`flex gap-4 overflow-x-auto lg:w-48 lg:shrink-0 lg:flex-col lg:overflow-visible`). When `isAdmin` is `true`, `TextLink` "Admin panel" → `/admin` is added at the end (05 §4).
`src/app/account/layout.tsx`: `const user = await getCurrentUser();` and `<AccountShell isAdmin={user?.isAdmin === true}>{children}</AccountShell>`. It does **not** guard: every page guards itself.
Do not change `src/app/account/page.tsx` (a later task replaces it).

Page `/account/themes` (05 §4): `requireUser("/account/themes")`; query `downloadErrorSearchParamsSchema.parse(await searchParams)`; `listOwnedThemes(user.id)`.
Metadata title `"My themes · Theme Store"`, `robots: { index: false }`. `Heading level 1` "My themes".
- When `downloadError` is set: `Alert tone="danger"` with `DOWNLOAD_ERROR_MESSAGES[downloadError]` above the list.
- No owned theme: `Text` "You do not own any themes yet." and `ButtonLink` "Browse themes" → `/themes`.
- Otherwise one `OwnedThemeCard` per theme (in the order of the service), in a `Grid`/`Stack`. `OwnedThemeCard` (a `Card`): the cover (`ImageFrame` for `theme.coverImage`, else `ThemeImagePlaceholder` from the themes feature, like `ThemeCard`);
  the name as `TextLink` to `/themes/<slug>` **only when `theme.status` is `"published"`**, otherwise plain `Heading level 3` text plus `Badge` "No longer sold" and no link;
  when there are versions: `Text size sm tone muted` `"Version <latest.version> · Updated <formatDate(latest.releasedAt)>"` (as on the theme page) and `DownloadButton` with `label` `"Download <latest.version>"`;
  when there are more versions: a native `<details>` with `<summary><Text as="span">Older versions</Text></summary>` and, for each older version (newest first), a row with `Text` `"<version> · <formatDate(releasedAt)>"` and a `DownloadButton size="sm" variant="secondary"` with label `"Download <version>"`;
  without versions: `Text` "The first version is coming soon.". `latest` is the first item of `versions`.

## Factory and e2e helper

`createOwnership(userId: string, themeId: string, overrides?)` in `factories.ts`. Defaults: `status "active"`, `source "admin_grant"`, `orderId null`, `grantedByUserId` = a new ObjectId, `grantNote null`,
`licenseType "standard"`, all `revoked*` fields `null`. For a revoked one the test passes `status`, `revokedAt`, `revokedReason` (and the fields it requires).

Add to `e2e/helpers.ts`:

```ts
// Uploads a real file to the local MinIO with the same presigned URL the app creates.
export async function putStoredFile(input: {
  bucket: "private" | "public";
  key: string;
  contentType: string;
  body: Buffer;
}): Promise<void> {
  if (!process.env.S3_ENDPOINT) process.loadEnvFile(".env");
  const { createUploadUrl } = await import("@/shared/storage/s3");
  const upload = await createUploadUrl({
    bucket: input.bucket,
    key: input.key,
    contentType: input.contentType,
    sizeBytes: input.body.length,
    cacheControl: null,
    expiresInSeconds: 600,
  });
  const response = await fetch(upload.url, { method: "PUT", headers: upload.headers, body: input.body });
  if (!response.ok) throw new Error(`Could not upload the test file (${response.status}).`);
}
```

## Required tests

`ownership.model.test.ts` (create with `OwnershipModel.create`; a refusal rejects with `name "ValidationError"` and `errors` containing the key shown, 0 rows)
- [ ] refuses a second ownership for the same user and theme → `await OwnershipModel.init()`; the second `create` rejects with `code 11000`; 1 row
- [ ] refuses a purchase without an order → key `orderId`
- [ ] refuses an admin grant without the admin → key `grantedByUserId`
- [ ] refuses an admin revoke without admin and note → `status "revoked"`, `revokedReason "admin"`: keys `revokedByUserId` and `revokeNote`
- [ ] saves defaults → `licenseType "standard"`, `grantNote null`, `revokedAt null`, `revokedReason null`
- [ ] keeps the three indexes → `collection.indexes()` has `{ userId: 1, themeId: 1 }` with `unique true`, `{ themeId: 1, status: 1, _id: 1 }` and `{ userId: 1, status: 1 }`

`ownership.service.test.ts` (real in-memory MongoDB; `createUser`, `createTheme`, `createVersion`, `createOwnership`, `setTestNow(new Date("2026-11-01T10:00:00Z"))`; the order id is `new Types.ObjectId().toString()`)
- [ ] hasActiveOwnership › is true only for an active ownership → active `true`; revoked `false`; none `false`; another user `false`; invalid ids (`"nope"`) `false`
- [ ] grantFromOrder › creates an active purchase ownership → returns `"created"`; 1 row: `status "active"`, `source "purchase"`, `orderId`, `grantedByUserId null`, `grantNote null`, `licenseType "standard"`, `revokedAt null`
- [ ] grantFromOrder › re-activates a revoked ownership in the same document → revoked row (`revokedReason "refund"`, `revokedAt` set): returns `"reactivated"`; still 1 row with the same `_id`; `status "active"`, new `orderId`, `source "purchase"`, `revokedAt null`, `revokedReason null`, `revokedByUserId null`, `revokeNote null`
- [ ] grantFromOrder › clears the admin data when it re-activates → revoked row that came from an admin grant with a note: after the call `grantedByUserId null`, `grantNote null`
- [ ] grantFromOrder › leaves an active ownership unchanged → active admin grant: returns `"unchanged"`; the row is identical to before (`source "admin_grant"`, `orderId null`); still 1 row
- [ ] grantFromOrder › joins the caller's transaction → `withTransaction(async (session) => { await grantFromOrder(input, session); throw new Error("boom"); })` rejects with "boom"; 0 ownerships
- [ ] revokeForRefund › revokes the ownership of this order → returns `true`; `status "revoked"`, `revokedReason "refund"`, `revokedAt` = the fixed `now()`, `revokedByUserId null`, `revokeNote null`
- [ ] revokeForRefund › does not revoke the ownership of a different order → returns `false`; still `active`
- [ ] revokeForRefund › does not revoke an admin grant → ownership with `orderId null`: returns `false`; still `active`
- [ ] revokeForRefund › ignores an ownership that is already revoked → returns `false`; `revokedAt` unchanged
- [ ] listOwnedThemes › returns only active ownerships of the user, sorted by theme name → themes "Zeta", "Alpha" owned; "Beta" revoked; "Gamma" owned by another user: result names `["Alpha", "Zeta"]`
- [ ] listOwnedThemes › includes unpublished themes with their status and cover → unpublished theme with 1 image: `theme.status "unpublished"`, `theme.coverImage.url` built from `PUBLIC_IMAGES_BASE_URL`
- [ ] listOwnedThemes › lists versions newest first and leaves a theme without versions with an empty list → 2 versions with different `releasedAt`; second theme `versions []`
- [ ] listOwnedThemes › returns an empty list for a user without ownerships
- [ ] grantByAdmin › `[PLANNER: tests of the "Admin grant and revoke" block: refusal of an active ownership, creating and re-activating, the note, the activity log]`
- [ ] revokeByAdmin › `[PLANNER: tests of the "Admin grant and revoke" block: refusal of a missing or revoked ownership, the revoke fields, the activity log]`

`theme.service.test.ts` (append)
- [ ] listThemeSummariesByIds › returns name, slug, status and cover of the given themes and leaves out unknown and invalid ids
- [ ] incrementDownloadCount › adds 1 to `stats.downloadCount` and changes nothing else; an unknown theme → NOT_FOUND `"Theme not found."`

`download.service.test.ts` (real in-memory MongoDB, `fakeStorage`, `setTestNow(new Date("2026-11-01T10:00:00Z"))`; helper creates a user, a theme with slug `aurora-blog`, a version `1.2.0` from `createVersion` and an active ownership; 30 logs are inserted with `DownloadLogModel.insertMany`, `createdAt` = the fixed `now()`)
- [ ] createDownloadLink › refuses a user without ownership → FORBIDDEN `"You do not own this theme."`; 0 download logs; `theme.stats.downloadCount` still 0
- [ ] createDownloadLink › refuses a revoked ownership → same FORBIDDEN; 0 logs
- [ ] createDownloadLink › refuses the ownership of another user → same FORBIDDEN
- [ ] createDownloadLink › allows an owner of an unpublished theme → resolves with a url; 1 log
- [ ] createDownloadLink › refuses an unknown version id → NOT_FOUND `"This file does not exist."`; 0 logs
- [ ] createDownloadLink › refuses an invalid version id → `"nope"`: same NOT_FOUND; 0 logs
- [ ] createDownloadLink › refuses the 31st download within 60 minutes → RATE_LIMITED `"You downloaded too many files in the last hour. Please try again later."`; still 30 logs; `downloadCount` unchanged
- [ ] createDownloadLink › the limit is per user → another owner can still download after the first user hit the limit
- [ ] createDownloadLink › allows a download 61 minutes after 30 others → `setTestNow` 61 minutes later; resolves; 31 logs
- [ ] createDownloadLink › logs the download and counts it → 1 log row with `userId`, `themeId`, `versionId` and `createdAt` = the fixed `now()`; `theme.stats.downloadCount` is 1; the url equals what `fakeStorage` returns: it contains the file key and `aurora-blog-1.2.0.zip` (URL-encoded as the fake does); `fakeStorage.downloadUrlRequests` equals `[{ key: <fileKey>, expiresInSeconds: 300, downloadFileName: "aurora-blog-1.2.0.zip" }]`

`download.schemas.test.ts`
- [ ] downloadErrorSearchParamsSchema › keeps the four known values and ignores anything else → `not_found`, `not_owned`, `rate_limited`, `failed` kept; `"constructor"`, `"bogus"` and a missing value give `undefined`

`e2e/downloads.spec.ts` (needs MongoDB and MinIO from docker compose). Tests run **in this order** and share the data.
Seed in `beforeAll` (`mongoose.connect(readMongoUri())`): a category; theme A `Owned Aurora <RUN_ID>` (slug `owned-aurora-<RUN_ID>`, published) with two versions made with `VersionModel.create`
(`1.0.0` released 2 days ago, `1.1.0` released now; each with `file.key` = `theme-zips/<themeId>/<16 hex>.zip`, a real zip `createZipFile("a/style.css", "<version> <RUN_ID>")` uploaded with `putStoredFile`, and its real `sizeBytes` and SHA-256);
theme B `Retired Aurora <RUN_ID>` (status `unpublished`, one version, no uploaded file needed); theme C `Coming Aurora <RUN_ID>` (published, no versions).
Register the customer `buyer-<RUN_ID>@example.com` once with `registerAs` on a page from the `browser` fixture; find its id with `mongoose.connection.db.collection("user").findOne({ email })`.
`afterAll`: delete ownerships, versions, download logs, the three themes, the category (`<RUN_ID>`), `mongoose.disconnect()`.
- [ ] a customer without themes sees the empty state and the account menu → `loginAs` the buyer; open `/account/themes`; text "You do not own any themes yet." and link "Browse themes" with `href` `/themes`; the navigation named "Account" has the link "My themes" with `aria-current="page"` and the links "Overview", "Orders", "Favorites", "Notifications", "Feedback", "Settings"; no link "Admin panel"
- [ ] owned themes show the latest and older versions → create three active ownerships (themes A, B, C) with `OwnershipModel.create` (`source "admin_grant"`, `grantedByUserId` any ObjectId); reload: link "Owned Aurora <RUN_ID>" visible; text "Version 1.1.0 · Updated" visible; link "Download 1.1.0" visible; click "Older versions", link "Download 1.0.0" visible; "Retired Aurora <RUN_ID>" is visible as text with "No longer sold", and there is **no link** with that name; "The first version is coming soon." is visible for theme C
- [ ] the customer downloads the latest zip → `const downloadPromise = page.waitForEvent("download")`, click the link "Download 1.1.0"; `download.suggestedFilename()` is `owned-aurora-<RUN_ID>-1.1.0.zip`; the downloaded bytes (`readFileSync(await download.path())`) equal the uploaded zip; DB: 1 download log with the buyer, theme A and version 1.1.0; theme A `stats.downloadCount` is 1
- [ ] a revoked ownership is refused with a message → set the ownership of theme A to `status "revoked"`, `revokedAt` now, `revokedReason "refund"` with `OwnershipModel.updateOne`; `page.goto` `/api/downloads/<version 1.1.0 id>`; the URL becomes `/account/themes?downloadError=not_owned`; text "You do not own this theme." is visible; still 1 download log
- [ ] a visitor is sent to the login page → in a new context (`browser.newContext()`) without login open `/api/downloads/<version id>`; the URL becomes `/login?next=%2Faccount%2Fthemes`
- [ ] an unknown downloadError value shows no message → open `/account/themes?downloadError=constructor`; none of the four texts of `DOWNLOAD_ERROR_MESSAGES` is on the page (`getByText(...)` count 0)

Break check (≥ 3): remove the ownership check in `createDownloadLink`; change `< DOWNLOADS_PER_HOUR` to `<=`; remove the `orderId` condition in `revokeForRefund`;
make `grantFromOrder` insert instead of re-activating a revoked ownership; remove the `status: "active"` filter in `existsActiveOwnership`.

## Do NOT

- Do not add any field or index that is not in 03 §8 and §17. Ownership is granted **only** by the Polar webhook, an admin approving a wallet payment, or an admin grant (D-034): never by a page.
- Never trust ids from the browser: the route uses the user id of the session only. Never put `fileKey` or a signed URL in a page, an email or a log.
- Do not make `DownloadButton` a `next/link`. Do not add an exception for admins in `createDownloadLink`.
- Do not write order, checkout, wallet or admin-customer code. Do not change `src/app/account/page.tsx`.
- Services and repositories do not import `next/*`. Feature components and pages: layout classes only (`pnpm check:styles`; visual classes are allowed only in `shared/ui` and `shared/layout`).
- No `any`, no `@ts-ignore`, no `eslint-disable`. Do not change the existing tests.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-009: ownerships and downloads`
