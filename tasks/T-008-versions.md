# T-008: Theme versions — zip upload, changelog, version pages

- Depends on: T-006, T-007
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2–7, 9; `docs/03-data-model.md` sections 1, 6, 19 ("Admin creates a version");
  `docs/07-delivery-updates.md` sections 1, 2.4, 4, 5, 11 (version, semver parts); `docs/01-decisions.md` D-015, D-019, D-056;
  `docs/05-pages.md` section 3 (`/themes/[slug]` Changelog) and section 5 (versions rows); `docs/09-emails.md` section 5.5 (admin view only);
  `docs/10-testing.md`. Copy `src/features/themes` (T-004) and the image upload of T-006 (`theme-image.*`, `useThemeImageUpload.ts`).

## Goal

The admin uploads a theme `.zip` **directly from the browser** to the private bucket, the server checks the stored file and saves a
version (changelog, SHA-256, notification job, activity log) in one transaction. The versions list, the changelog editor and the public
changelog on the theme page.

**Not in this task:** downloads and `DownloadButton` (T-009), processing the notification job (T-014), the `/admin/notifications` page
and its Retry button (T-017), the publish checklist, "Publish" and Polar sync (T-010), "My themes" (T-009). The docs say
`updateVersionChanges({ versionId, changes }, adminUserId)`; **leave the unused `adminUserId` out** (same rule as the T-004 services).

## Files

```
src/shared/lib/semver.ts / semver.test.ts        compareSemver, nextPatchVersion
src/shared/lib/files.ts / files.test.ts          formatMegabytes

src/features/versions/
  version.model.ts / version.repository.ts / version.service.ts / version-upload.service.ts
  version.mapper.ts / version.schemas.ts / version.types.ts / version.constants.ts / version.actions.ts
  version.service.test.ts / version.schemas.test.ts / version.mapper.test.ts
  components/Changelog.tsx
  components/admin/VersionForm.tsx            ("use client")
  components/admin/useVersionUpload.ts        (hook, "use client")
  components/admin/ChangesEditor.tsx          ("use client")
  components/admin/VersionChangesForm.tsx     ("use client")
  components/admin/VersionList.tsx
  components/admin/CopyTextButton.tsx         ("use client")

src/features/themes/theme.service.ts        (change) add setLatestVersion
src/features/themes/theme.repository.ts     (change) add updateLatestVersion
src/features/themes/theme.types.ts          (change) ThemeAdminDTO gets latestVersion: string | null
src/features/themes/theme.mapper.ts         (change) fill it
src/features/themes/theme.service.test.ts   (change) append the setLatestVersion test below
src/features/themes/theme.mapper.test.ts    (change) append the mapper test below

src/features/notifications/notification.constants.ts       (change) add NOTIFICATION_JOB_STATUS_LABELS
src/features/notifications/notification.types.ts           (change) add NotificationJobSummaryDTO
src/features/notifications/notification-job.mapper.ts      toNotificationJobSummaryDTO
src/features/notifications/notification-job.repository.ts  (change) add findNotificationJobsByIds
src/features/notifications/notification-job.service.ts     (change) add getJobSummaries
src/features/notifications/notification-job.service.test.ts (change) append the getJobSummaries test below

src/shared/test/factories.ts                (change) add createVersion(themeId, overrides?)
src/app/admin/themes/[id]/page.tsx          (change) add TextLink "Versions (<n>)"
src/app/admin/themes/[id]/versions/page.tsx
src/app/admin/themes/[id]/versions/new/page.tsx
src/app/admin/themes/[id]/versions/[versionId]/page.tsx
src/app/themes/[slug]/page.tsx              (change) show Changelog below ThemeDetail
e2e/helpers.ts                              (change) add createZipFile (below)
e2e/versions.spec.ts
```

## Packages

None (no zip library: the server never opens the zip, 07 §4.3).

## Shared helpers

`semver.ts` (07 §4.5): `compareSemver(a: string, b: string): -1 | 0 | 1` compares major, then minor, then patch **as numbers**; both inputs already match the `semver` format.
`nextPatchVersion(version: string): string` returns `<major>.<minor>.<patch + 1>` (`"1.4.0"` → `"1.4.1"`, `"1.9.9"` → `"1.9.10"`).
`files.ts`: `formatMegabytes(sizeBytes: number): string` = `(sizeBytes / 1_048_576).toFixed(1) + " MB"` (05 §5: "size (MB, 1 decimal)"; 1 MB = 1 048 576 bytes, like the 200 MB limit).

## Constants (`version.constants.ts`)

```ts
export const MAX_ZIP_BYTES = 209_715_200;
export const ZIP_UPLOAD_SECONDS = 1800;
export const ZIP_SIGNATURE_HEX = "504b0304";
export const ZIP_CONTENT_TYPE = "application/zip";
export const CHANGE_TYPES = ["new", "improved", "fixed", "removed"] as const;
export const MAX_CHANGES = 50;
export const CHANGE_TEXT_MIN = 2;
export const CHANGE_TEXT_MAX = 200;
export const FILE_NAME_MAX = 200;           // original file name
export const FILE_KEY_MAX = 300;
export const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;   // same regex as in theme.constants.ts (a model may import only its own constants)
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;
export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = { new: "New", improved: "Improved", fixed: "Fixed", removed: "Removed" };  // 09 §3.1 #7
export const VERSION_MESSAGES = {
  themeNotFound: "Theme not found.",
  versionNotFound: "Version not found.",
  invalidZip: "Please choose a .zip file of at most 200 MB.",
  fileNotFound: "We could not find the uploaded file. Please upload it again.",
  fileAlreadyUsed: "This file is already used by another version. Please upload it again.",
  notAZip: "This file is not a valid .zip file.",
  uploadFailed: "The upload failed. Please check your connection and try again.",
  versionFormat: "Use a version like 1.4.0.",
  changesCount: "Add between 1 and 50 changes.",
  changeText: "Each change needs 2 to 200 characters.",
} as const;
```
Also export `type ChangeType`. Messages with a value inside are built in the service: `"The version must be higher than <latest>."`, `"Version <version> already exists for this theme."`.

## Model (`version.model.ts`)

Exactly 03 §6 (collection `"themeVersions"`, `{ timestamps: true }`, model name `"Version"`, export `VersionModel`, `VersionRecord`), fields in this order:
`themeId` (ObjectId `ref: "Theme"`, required); `version` (string, required, trimmed, `match: SEMVER_PATTERN`);
`changes` (array of `{ type: enum CHANGE_TYPES, text: string trimmed 2–200 }` sub-documents with `{ _id: false }`, required, 1–50 items checked by a validator function like `hasAtMostFeatures` in `theme.model.ts`);
`file` sub-document `{ _id: false }`: `key` (required), `sizeBytes` (required, integer, 1–`MAX_ZIP_BYTES`), `sha256` (required, `match: SHA256_PATTERN`), `originalName` (required, trimmed, max 200);
`releasedAt` (Date, required); `notifyRequested` (Boolean, required); `notificationJobId` (ObjectId `ref: "NotificationJob"`, default `null`).
Every field has a comment. Indexes (03 §6): `{ themeId: 1, version: 1 }` unique; `{ "file.key": 1 }` unique; `{ themeId: 1, releasedAt: -1 }`.

## Repository (`version.repository.ts`)

Each function calls `connectDB()` first and returns `.lean()` records; writes take an optional last `session?: ClientSession`.
`insertVersion(fields, session?)` (use `VersionModel.create([fields], { session })`), `findVersionById(id)` (null for an invalid id, like `findThemeById`),
`findVersionsByThemeId(themeId)` (sorted `releasedAt` desc, then `_id` desc), `countVersionsByThemeId(themeId)`, `existsVersionByFileKey(fileKey)`,
`setVersionNotificationJobId(versionId, jobId, session?)`, `updateVersionChangesById(versionId, changes)` (returns the record or `null`; sets **only** `changes`),
`findDuplicateKeyField(error): "version" | "fileKey" | null` — `null` unless `error.code === 11000`; `"fileKey"` when `error.keyPattern` has the key `"file.key"`, `"version"` when it has the key `"version"`.
The fields object of `insertVersion` is `{ themeId: string; version; changes; file: { key, sizeBytes, sha256, originalName }; releasedAt: Date; notifyRequested: boolean }`.

## Themes feature changes

- `theme.repository.ts`: `updateLatestVersion(themeId, latestVersion: { versionId: string; version: string; releasedAt: Date }, session?)` — `ThemeModel.updateOne({ _id }, { $set: { latestVersion: { versionId: toObjectId(...), version, releasedAt } } }, { session })`.
- `theme.service.ts`: `setLatestVersion(themeId, latestVersion, session?): Promise<void>` calls it and throws NOT_FOUND `"Theme not found."` when the theme does not exist. Only this function writes `latestVersion` (03 §5).
- `ThemeAdminDTO.latestVersion`: the version string or `null` (`theme.latestVersion?.version ?? null`).

## Service (`version.service.ts`, `version-upload.service.ts`)

Theme data comes from the themes service (`getThemeForAdmin(themeId)`, which returns `name` and `latestVersion`). Functions are short: split into helpers (02 §3).

| Function | Rules / errors |
|---|---|
| `createZipUploadUrl({ themeId, fileName, sizeBytes }): Promise<PresignedUpload>` | 1 theme exists, else NOT_FOUND `"Theme not found."`. 2 `fileName` ends with `.zip` (case-insensitive) and has 1–200 characters, and `sizeBytes` is 1 – 209 715 200, else INVALID `"Please choose a .zip file of at most 200 MB."`. Then `createUploadUrl({ bucket: "private", key: newThemeZipKey(themeId), contentType: "application/zip", sizeBytes, cacheControl: null, expiresInSeconds: 1800 })` — always our own content type, never the browser's `file.type`. |
| `createVersion(input: CreateVersionInput, adminUserId: string): Promise<VersionAdminDTO>` | Steps 1–5 of 07 §4.3. 1 theme exists (NOT_FOUND `"Theme not found."`). 2 when the theme has a `latestVersion`: `compareSemver(input.version, latestVersion) > 0`, else CONFLICT `"The version must be higher than <latest>."` (e.g. `"The version must be higher than 1.4.0."`). 3 `checkUploadedZip(themeId, fileKey)` (below) gives `{ sizeBytes, sha256 }`. 4 **one transaction** (`withTransaction`, 03 §19): insert the version (`releasedAt = now()`, `notifyRequested = input.notify`, `notificationJobId null`); `setLatestVersion(themeId, { versionId, version, releasedAt })`; when `notify`: `createVersionReleasedJob({ themeId, versionId, createdByUserId: adminUserId }, session)` from the notifications service and `setVersionNotificationJobId`; `activityService.log({ action: "version_released", actorRole: "admin", actorUserId: adminUserId, targetType: "theme", targetId: themeId, summary: "Version released: <Theme name> <version>" }, session)`. Every call inside gets the same `session`. A duplicate key on the insert: `"version"` → CONFLICT `"Version <version> already exists for this theme."`, `"fileKey"` → CONFLICT `"This file is already used by another version. Please upload it again."`. 5 return the `VersionAdminDTO`. The slow steps (HEAD and hashing) run **before** the transaction, never inside it. |
| `checkUploadedZip(themeId, fileKey): Promise<{ sizeBytes: number; sha256: string }>` (in `version-upload.service.ts`) | 1 `fileKey` starts with `themeZipPrefix(themeId)`, else INVALID `"We could not find the uploaded file. Please upload it again."`. 2 no version uses `fileKey` (`existsVersionByFileKey`), else CONFLICT `"This file is already used by another version. Please upload it again."`. 3 `headObject({ bucket: "private", key: fileKey })` is not `null`, else the INVALID of check 1. 4 `sizeBytes` is 1 – 209 715 200, else `deleteObject` and INVALID `"Please choose a .zip file of at most 200 MB."`. 5 `hashObject`; when `firstBytesHex` is not `"504b0304"`: `deleteObject` and INVALID `"This file is not a valid .zip file."`. 6 return `{ sizeBytes, sha256 }`. |
| `updateVersionChanges({ versionId, changes }): Promise<void>` | version not found (or invalid id) → NOT_FOUND `"Version not found."`. Updates **only** `changes`. No notification job, no activity log (03 §6). |
| `listVersionsForTheme(themeId): Promise<VersionDTO[]>` | Newest first (`releasedAt` desc). `VersionDTO = { id, version, releasedAt, changes: { type, text }[], sizeBytes }`. No `fileKey`, no `sha256`. |
| `getVersionForDownload(versionId): Promise<{ id: string; themeId: string; version: string; fileKey: string } \| null>` | `null` for an invalid or unknown id. Only the downloads service will use it (T-009). |
| `listVersionsForAdmin(themeId): Promise<VersionAdminListItemDTO[]>` | Newest first. `VersionAdminListItemDTO = VersionAdminDTO & { notification: NotificationJobSummaryDTO \| null }`; the jobs come from `getJobSummaries` of the notifications service (one call for all versions). |
| `getVersionForAdmin(themeId, versionId): Promise<VersionAdminDTO \| null>` | `null` when the version does not exist **or belongs to another theme**. |
| `countVersionsForTheme(themeId): Promise<number>` | for the "Versions (<n>)" link. |

`VersionAdminDTO` exactly as 07 §4.3: `{ id, version, releasedAt, changes, sizeBytes, sha256, originalName, notifyRequested }`.
Mapper (`version.mapper.ts`): `toVersionDTO(record)`, `toVersionAdminDTO(record)`.

Notifications feature (the versions feature must not import its repository, D-087):
`NotificationJobSummaryDTO = { id: string; status: NotificationJobStatus; notifiedCount: number; emailedCount: number; error: string | null }`;
`notification-job.mapper.ts` has `toNotificationJobSummaryDTO(record)`; repository `findNotificationJobsByIds(ids: string[])` (invalid ids ignored);
service `getJobSummaries(jobIds: string[]): Promise<Map<string, NotificationJobSummaryDTO>>` (job id → summary; unknown ids are missing from the map);
`NOTIFICATION_JOB_STATUS_LABELS = { pending: "Pending", running: "Running", done: "Done", failed: "Failed" }`.

## Schemas (`version.schemas.ts`)

- `createVersionSchema` (07 §4.3 table): `themeId` string; `version` trimmed, regex `SEMVER_PATTERN`, message `"Use a version like 1.4.0."`;
  `changes` array of `{ type: z.enum(CHANGE_TYPES), text: trimmed string 2–200 }`, array length 1–50 with message `"Add between 1 and 50 changes."`,
  text length message `"Each change needs 2 to 200 characters."`; `notify` boolean; `fileKey` string 1–300; `originalName` string 1–200. Type `CreateVersionInput`.
- `createZipUploadUrlSchema`: `{ themeId: string, fileName: string, sizeBytes: number }`.
- `updateVersionChangesSchema`: `{ versionId: string, changes }` with the same `changes` rule.
- `versionsPageSearchParamsSchema`: `released: z.string().regex(SEMVER_PATTERN).optional().catch(undefined)`, `notified: z.literal("1").optional().catch(undefined)`.
Every field error of `changes` (array length and text length) ends up under the key `changes` of `fieldErrors`.

## Actions (`version.actions.ts`)

Each takes **one argument `unknown`** (called from client code), starts with `requireAdmin()`, then `safeParse` (`validationFailure(parsed.error, {})`), then the service in try/catch (`failureFrom(error, name, {})`).
- `createZipUploadUrlAction(input): Promise<ActionResult<PresignedUpload>>`.
- `createVersionAction(input): Promise<ActionResult>`: on success revalidate `/admin/themes/[id]` (page), `/admin/themes/[id]/versions` (page), `/themes/[slug]` (page) and `/account/themes`, then
  `redirect(`/admin/themes/${themeId}/versions?released=${version}`)` with `&notified=1` added when `notify` was `true` (07 §4.1 step 5). The redirect is **outside** the try/catch.
- `updateVersionChangesAction(input): Promise<ActionResult>`: on success revalidate `/admin/themes/[id]/versions` (page) and `/themes/[slug]` (page); return `{ ok: true, data: undefined, message: "Saved." }`.

## Pages

All admin pages: `requireAdmin()`, metadata title `"<Page title> · Theme Store"` with `robots: { index: false }`. An unknown theme id, a version of another theme, or an invalid id → `notFound()`.
- `/admin/themes/[id]` (change): below the existing content add `TextLink` `"Versions (<n>)"` → `/admin/themes/<id>/versions` (`n` from `countVersionsForTheme`). Nothing else changes.
- `/admin/themes/[id]/versions`: `listVersionsForAdmin`; `ButtonLink` "Upload new version" → `/admin/themes/<id>/versions/new`; the table of `VersionList` (05 §5: version, date, size in MB with 1 decimal via `formatMegabytes`,
  SHA-256 = first 12 characters + `CopyTextButton` that copies the full value, notification status = job status + counts, `TextLink` "Edit changelog" → `/admin/themes/<id>/versions/<versionId>`).
  `Alert tone="success"` when `released` is set: `"Version <released> released."` plus `" Notifications are being sent."` when `notified` is `"1"` (07 §4.1 step 5). Query parsed with `versionsPageSearchParamsSchema`.
- `/admin/themes/[id]/versions/new`: `VersionForm` (07 §4.1).
- `/admin/themes/[id]/versions/[versionId]`: `getVersionForAdmin`; `VersionChangesForm` with the current changes (07 §4.4).
- `/themes/[slug]` (change): after `<ThemeDetail>` render `<Changelog versions={await listVersionsForTheme(theme.id)} />` inside a `Stack`. `Changelog` (05 §3): `Heading level 2` "Changelog"; for each version `Heading level 3` `"<version> — <formatDate(releasedAt)>"`
  and its changes, each as `Badge` (label from `CHANGE_TYPE_LABELS`) + `Text` with the change text. The whole section is hidden when there are no versions.

`VersionForm` fields (07 §4.1): `TextField` "Version" (placeholder = next patch number: `nextPatchVersion(latestVersion)` when the theme has a version; `"1.0.0"` when it has none),
`ChangesEditor`, `FileField` "Zip file" (`accept=".zip,application/zip"`), `CheckboxField` "Notify owners and people who favorited this theme" (`defaultChecked`), and `Button type="submit"` "Upload and release".
`useVersionUpload` runs the flow of 07 §4.1 on submit: (1) the file name ends with `.zip` (case-insensitive) and `file.size` is 1 – 209 715 200, else show `VERSION_MESSAGES.invalidZip` and stop;
(2) `createZipUploadUrlAction({ themeId, fileName: file.name, sizeBytes: file.size })`, on `ok: false` show `result.error`; (3) `uploadFile(...)` with a `ProgressBar` and the text `"Uploading… 42%"` (the real percent), on rejection show `VERSION_MESSAGES.uploadFailed`;
(4) `createVersionAction({ themeId, version, changes, notify, fileKey: <key from step 2>, originalName: file.name })` while showing `"Checking the file…"`; on `ok: false` show `result.error` and the `fieldErrors` (`version`, `changes`).
On success the action redirects, so the hook does nothing after it. While a step runs the submit button is disabled.

Wording and layout of the version pages:
- Page headings: versions list `"Versions of <theme name>"`; new page `"Upload a new version"`; edit page `"Edit changelog: <theme name> <version>"` with `TextLink` "Back to versions". Empty list: `"No versions yet."`.
- Table header cells: "Version", "Released", "Size", "SHA-256", "Notifications", "Actions". `CopyTextButton`: `Button size="sm" variant="secondary"` "Copy", showing "Copied" for the rest of the page visit after a click (uses `navigator.clipboard.writeText`).
- Notifications cell: `—` when `notification` is `null`; otherwise a `Badge` with `NOTIFICATION_JOB_STATUS_LABELS[status]` (tone: pending neutral, running primary, done success, failed danger), then `Text size sm` `"<notifiedCount> notified, <emailedCount> emailed"`, and for a failed job the `error` text.
- `ChangesEditor` (props: `changes`, `onChange`, `errors`): per row n (starting at 1) `SelectField` label `"Type of change n"` (options from `CHANGE_TYPE_LABELS`), `TextField` label `"Text of change n"`, `Button size="sm" variant="secondary"` `"Remove change n"`; below the rows `Button variant="secondary"` "Add change". The form starts with one empty row of type `new`.
- `VersionChangesForm`: `ChangesEditor` + `Button type="submit"` "Save changes"; success `Alert tone="success"` with the `message` of the result.
- Public changelog: all `Badge` tones `neutral`.

## Factory (`createVersion`)

`createVersion(themeId: string, overrides?)` in `factories.ts`: inserts one row only (it does **not** touch the theme). Defaults: `version "1.0.0"`, `changes [{ type: "new", text: "First release" }]`,
`file { key: "theme-zips/<themeId>/<16 digits of the counter, zero padded>.zip", sizeBytes: 1000, sha256: "a" repeated 64 times, originalName: "theme.zip" }`, `releasedAt: now()`, `notifyRequested: false`, `notificationJobId: null`.

## e2e helper (`createZipFile`)

Add to `e2e/helpers.ts` exactly:

```ts
import { crc32 } from "node:zlib";

const DOS_DATE_1980_01_01 = 33;

// A real .zip file with one stored (not compressed) file inside.
export function createZipFile(fileName: string, content: string): Buffer {
  const name = Buffer.from(fileName, "utf8");
  const data = Buffer.from(content, "utf8");
  const checksum = crc32(data);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4); // version needed
  localHeader.writeUInt16LE(0, 6); // flags
  localHeader.writeUInt16LE(0, 8); // method: stored
  localHeader.writeUInt16LE(0, 10); // time
  localHeader.writeUInt16LE(DOS_DATE_1980_01_01, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(data.length, 18); // compressed size
  localHeader.writeUInt32LE(data.length, 22); // size
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28); // extra length
  const localPart = Buffer.concat([localHeader, name, data]);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4); // version made by
  centralHeader.writeUInt16LE(20, 6); // version needed
  centralHeader.writeUInt16LE(0, 8); // flags
  centralHeader.writeUInt16LE(0, 10); // method
  centralHeader.writeUInt16LE(0, 12); // time
  centralHeader.writeUInt16LE(DOS_DATE_1980_01_01, 14);
  centralHeader.writeUInt32LE(checksum, 16);
  centralHeader.writeUInt32LE(data.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(name.length, 28);
  centralHeader.writeUInt32LE(0, 42); // offset of the local header
  const centralPart = Buffer.concat([centralHeader, name]);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8); // entries on this disk
  end.writeUInt16LE(1, 10); // entries in total
  end.writeUInt32LE(centralPart.length, 12);
  end.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, end]);
}
```

## Required tests

`semver.test.ts` / `files.test.ts`
- [ ] compareSemver › compares numbers, not text → `compareSemver("1.10.0", "1.9.0")` is `1`, `("1.9.0", "1.10.0")` is `-1`, `("1.4.0", "1.4.0")` is `0`, `("2.0.0", "1.99.99")` is `1`, `("1.4.1", "1.4.0")` is `1`
- [ ] nextPatchVersion › adds 1 to the patch → `"1.4.0"` gives `"1.4.1"`, `"1.9.9"` gives `"1.9.10"`
- [ ] formatMegabytes › shows MB with 1 decimal → `209715200` gives `"200.0 MB"`, `1572864` gives `"1.5 MB"`

`version.service.test.ts` (real in-memory MongoDB, `fakeStorage`, `setTestNow`; admin from `createAdmin`; a valid zip body is `Buffer.concat([Buffer.from("504b0304", "hex"), Buffer.from("rest of the file")])`;
store it with `fakeStorage.putTestObject({ bucket: "private", key, contentType: "application/zip", body })` where `key` starts with `theme-zips/<themeId>/`)
- [ ] createZipUploadUrl › refuses a file not ending in .zip and a file over 209 715 200 bytes → INVALID `"Please choose a .zip file of at most 200 MB."` for `"theme.rar"` (1000 bytes), for `"theme.zip"` with `209715201` and with `0`; `uploadUrlRequests` empty
- [ ] createZipUploadUrl › accepts an upper-case extension and uses our own content type → `"THEME.ZIP"` works; `uploadUrlRequests` equals `[{ bucket: "private", key: <result.key>, contentType: "application/zip", sizeBytes, cacheControl: null, expiresInSeconds: 1800 }]`; `result.key` matches `^theme-zips/<themeId>/[0-9a-f]{16}\.zip$`
- [ ] createZipUploadUrl › refuses an unknown theme → NOT_FOUND `"Theme not found."`
- [ ] createVersion › refuses a version that is not higher than the latest → theme with `latestVersion 1.4.0` and 1 existing version row: `"1.4.0"` and `"1.3.9"` each give CONFLICT `"The version must be higher than 1.4.0."`; still 1 version in DB; 0 notification jobs; 0 activity logs; `latestVersion.version` still `"1.4.0"`
- [ ] createVersion › accepts 1.10.0 after 1.9.0 → saved; `theme.latestVersion.version` is `"1.10.0"`
- [ ] createVersion › accepts the first version of a theme → theme without `latestVersion`, version `"1.0.0"` saved
- [ ] createVersion › refuses a file key of another theme → INVALID `"We could not find the uploaded file. Please upload it again."`; 0 versions
- [ ] createVersion › refuses a file that is not in storage → same INVALID; 0 versions
- [ ] createVersion › refuses an empty file and deletes it → stored body is empty: INVALID `"Please choose a .zip file of at most 200 MB."`; object gone from `fakeStorage.objects`; 0 versions
- [ ] createVersion › deletes and refuses a file that does not start with the zip signature → INVALID `"This file is not a valid .zip file."`; object gone; 0 versions; theme `latestVersion` still `null`
- [ ] createVersion › stores the real SHA-256 and size of the uploaded file → `sha256` equals the value computed in the test with `node:crypto` from the body; `sizeBytes` equals the body length; `originalName` saved; `releasedAt` equals the fixed `now()`
- [ ] createVersion › updates the theme and logs version_released → `theme.latestVersion` has the new `versionId`, `version` and `releasedAt`; 1 activity row: `action "version_released"`, `actorRole "admin"`, `actorUserId` = admin, `targetType "theme"`, `targetId` = theme, `summary "Version released: <Theme name> 1.5.0"`
- [ ] createVersion › with notify creates one version_released job and sets notificationJobId → 1 job: `kind "version_released"`, `stage "theme_owners"`, `themeId`, `versionId` = the new version, `createdByUserId` = admin; `version.notificationJobId` = that job; `notifyRequested true`
- [ ] createVersion › without notify creates no job → 0 jobs; `notificationJobId null`; `notifyRequested false`
- [ ] createVersion › refuses a file key already used by another version → CONFLICT `"This file is already used by another version. Please upload it again."`; still 1 version; object still stored
- [ ] createVersion › refuses a version number that already exists for the theme → theme has a version row `"1.0.0"` but `latestVersion null`: CONFLICT `"Version 1.0.0 already exists for this theme."`; still 1 version; 0 jobs; 0 activity logs; `latestVersion` still `null`
- [ ] createVersion › refuses an unknown theme → NOT_FOUND `"Theme not found."`
- [ ] updateVersionChanges › changes only changes → version's `version`, `file`, `releasedAt`, `notifyRequested` unchanged; 0 notification jobs; 0 activity logs
- [ ] updateVersionChanges › refuses an unknown or invalid version id → NOT_FOUND `"Version not found."` for a new ObjectId and for `"nope"`
- [ ] listVersionsForTheme › returns the newest first without file data → 3 versions with different `releasedAt`; order newest first; each DTO has exactly the keys `changes`, `id`, `releasedAt`, `sizeBytes`, `version` (sorted)
- [ ] getVersionForDownload › returns the file key, and null for an unknown or invalid id → `{ id, themeId, version, fileKey }`
- [ ] listVersionsForAdmin › includes the notification summary → version with a job: `notification` has `status "pending"`, counts 0; version without job: `notification null`; `sha256` present
- [ ] getVersionForAdmin › returns null for a version of another theme

`version.schemas.test.ts` / `version.mapper.test.ts`
- [ ] createVersionSchema › refuses bad version numbers → `"1.04.0"`, `"1.4"`, `"v1.4.0"` give `"Use a version like 1.4.0."` on `version`
- [ ] createVersionSchema › refuses 0 and 51 changes → `"Add between 1 and 50 changes."` on `changes`
- [ ] createVersionSchema › refuses a change text of 1 and of 201 characters → `"Each change needs 2 to 200 characters."` on `changes`; trims `"  Fixed bug  "` to `"Fixed bug"`
- [ ] versionsPageSearchParamsSchema › keeps a valid released version and falls back for others → `released "1.0.0"` kept; `released "<script>"` gives `undefined`; `notified "1"` kept, `"2"` gives `undefined`
- [ ] toVersionDTO › has no file key and no hash → `Object.keys(dto).sort()` equals `["changes", "id", "releasedAt", "sizeBytes", "version"]`
- [ ] toVersionAdminDTO › has the hash, original name and notify flag

`theme.service.test.ts` (append) / `theme.mapper.test.ts` (append) / `notification-job.service.test.ts` (append)
- [ ] setLatestVersion › writes only latestVersion → status, stats, images unchanged; unknown theme → NOT_FOUND `"Theme not found."`
- [ ] toThemeAdminDTO › has the latest version string, or null without versions
- [ ] getJobSummaries › returns one summary per known job id → maps id to `{ id, status, notifiedCount, emailedCount, error }`; unknown id missing

`e2e/versions.spec.ts` (needs MongoDB and MinIO from docker compose). The tests of this file run **in this order** and share the theme.
Seed in `beforeAll` (`mongoose.connect(readMongoUri())`, `removeAdminAccount()`): one category and one **published** theme `Versioned Aurora <RUN_ID>` (slug `versioned-aurora-<RUN_ID>`), no versions.
Create the admin once with `registerAs` on a page from the `browser` fixture. `const zip = createZipFile("aurora/style.css", "/* Theme Name: Aurora */")`; its SHA-256 is computed with `node:crypto` in the test.
`afterAll`: delete the versions of the theme, the theme, the category, the notification jobs of the theme, the activity rows of the theme (`targetId`), `mongoose.disconnect()`.
- [ ] admin releases a version with a real zip → `loginAs`; open `/admin/themes/<id>/versions/new`; the "Version" field has the placeholder `1.0.0`; fill "Version" `1.0.0`, "Type of change 1" `New`, "Text of change 1" `First release of the theme`; `getByLabel("Zip file").setInputFiles({ name: "aurora.zip", mimeType: "application/zip", buffer: zip })`; click "Upload and release"; the URL becomes `/admin/themes/<id>/versions?released=1.0.0&notified=1`; text "Version 1.0.0 released. Notifications are being sent." is visible; the table row shows `1.0.0`, `0.0 MB` and the first 12 characters of the SHA-256; DB: 1 version with the full `sha256`, theme `latestVersion.version "1.0.0"`, 1 notification job with `status "pending"`, 1 activity row `version_released`
- [ ] admin cannot release a version that is not higher → open the form again, version `1.0.0`, same change text, the zip; click "Upload and release": the text "The version must be higher than 1.0.0." is visible; DB still 1 version
- [ ] a file that is not a zip is refused before uploading → choose `{ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") }`, version `1.0.1`, a change text; click: "Please choose a .zip file of at most 200 MB." is visible; DB still 1 version
- [ ] visitors see the changelog on the theme page → open `/themes/versioned-aurora-<RUN_ID>` (no login): heading "Changelog", the text `1.0.0 — `, the change text `First release of the theme` and the badge `New` are visible
- [ ] admin edits a changelog without notifying again → `loginAs`; open the versions page, click "Edit changelog"; fill "Text of change 1" with `Rewrote the release notes`; click "Save changes"; "Saved." is visible; DB change text updated; still exactly 1 notification job; the public theme page shows `Rewrote the release notes`

Break check (≥ 3): remove the `compareSemver` check in `createVersion`; remove the signature check in `checkUploadedZip`; pass no `session` to `createVersionReleasedJob`;
change `setLatestVersion` to be skipped.

## Do NOT

- Do not add any field or index that is not in 03 §6. Never delete a version and never replace a zip (D-015): there is no delete or replace function.
- The `fileKey` never leaves the server: no DTO of a page or action contains it (only `getVersionForDownload`, for T-009).
- Do not open the zip, do not add a zip package, do not read the whole file into memory (the storage module streams it).
- Do not call `createVersionReleasedJob` or `activityService.log` outside the transaction.
- Services and repositories do not import `next/*`. Feature components and pages: layout classes only (`pnpm check:styles`).
- No `any`, no `@ts-ignore`, no `eslint-disable`. Do not change the existing tests.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-008: theme versions`
