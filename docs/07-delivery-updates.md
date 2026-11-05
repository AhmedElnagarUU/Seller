# 07 — Files: storage, uploads, versions, downloads

This doc covers **everything about files**:
- how theme `.zip` files, theme images and wallet proof screenshots get **into** storage;
- how customers get zips **out** of storage;
- how Cloudflare R2 and the local MinIO are set up.

Emails and in-app notifications about new versions are in `09-emails.md`.

Decisions used here: D-015, D-016, D-049, D-051, D-053 – D-059, D-104.

---

## 1. Overview

```
UPLOAD (admin zip, admin image, customer proof) — the file never passes through our server (D-056)

  Browser ──1. "I want to upload X (type, size)"──▶ server action ──▶ service checks rules
          ◀──2. { key, url, headers } (presigned PUT)──
  Browser ──3. PUT file (with those headers)──────▶ R2 (or MinIO)
  Browser ──4. "save it" (key + form fields)──────▶ server action ──▶ service: HEAD (+ SHA-256 for zips) ──▶ MongoDB

DOWNLOAD (customer zip)

  Browser ──GET /api/downloads/<versionId>──▶ route: user? owner? rate limit? log it
          ◀──302 redirect to a signed R2 URL (valid 5 minutes)──
  Browser ──GET──▶ R2 (download is free: R2 has no egress fees)
```

| What | Bucket | Key format | Max size | Types |
|---|---|---|---|---|
| Theme zip | private | `theme-zips/<themeId>/<16 hex>.zip` | 200 MB (209 715 200 bytes) | `.zip` |
| Theme image | public | `theme-images/<themeId>/<16 hex>.<jpg\|png\|webp>` | 3 MB (3 145 728 bytes) | JPG, PNG, WebP |
| Wallet proof | private | `wallet-proofs/<walletPaymentId>/<16 hex>.<jpg\|png\|webp>` | 5 MB (5 242 880 bytes) | JPG, PNG, WebP |

`<16 hex>` = `randomBytes(8).toString("hex")` from `node:crypto`. Every upload gets a **new** key, so a stored
file is never overwritten (D-015).

---

## 2. Files

```
shared/storage/
├─ s3.ts                 The ONLY file that imports @aws-sdk/*. Section 2.1.
├─ keys.ts               Key builders and prefix helpers. Pure functions. Section 2.2.
├─ public-url.ts         publicImageUrl(key). Section 2.3.
└─ upload-file.ts        Browser-only helper that PUTs a file with progress. Section 2.4.

shared/lib/semver.ts     compareSemver(a, b)

features/themes/
├─ theme-image.service.ts     Section 3
├─ theme-image.actions.ts
├─ theme-image.schemas.ts
└─ components/admin/ThemeImagesManager.tsx

features/versions/
├─ version.model.ts / .repository.ts / .service.ts / .mapper.ts / .actions.ts / .schemas.ts / .types.ts / .constants.ts
├─ version-upload.service.ts  Section 4.2 (checking the uploaded zip)
└─ components/admin/VersionForm.tsx, components/admin/VersionList.tsx, components/Changelog.tsx

features/downloads/
├─ download-log.model.ts / download-log.repository.ts
├─ download.service.ts        Section 7
├─ download.constants.ts      DOWNLOADS_PER_HOUR = 30, DOWNLOAD_LINK_SECONDS = 300, DOWNLOAD_ERROR_MESSAGES
└─ components/DownloadButton.tsx

app/api/downloads/[versionId]/route.ts   Section 7.2
```

### 2.1 `shared/storage/s3.ts`

These are the only exports. `FakeStorage` (`10-testing.md` section 4) has exactly the same exports.

```ts
export type StorageBucket = "private" | "public";
export type PresignedUpload = { key: string; url: string; headers: Record<string, string> };
export type StoredObjectInfo = { sizeBytes: number; contentType: string };

// Presigned PUT. The URL only works for exactly this content type and size.
export async function createUploadUrl(input: {
  bucket: StorageBucket; key: string; contentType: string; sizeBytes: number;
  cacheControl: string | null; expiresInSeconds: number;
}): Promise<PresignedUpload>;

// Presigned GET on the PRIVATE bucket. downloadFileName → "attachment; filename=..."; null → shown inline.
export async function createDownloadUrl(input: {
  key: string; expiresInSeconds: number; downloadFileName: string | null;
}): Promise<string>;

// null when the object does not exist (404). Any other error is thrown.
export async function headObject(input: { bucket: StorageBucket; key: string }): Promise<StoredObjectInfo | null>;

// Streams the object (never loads it all into memory). Returns the lowercase hex SHA-256
// and the first 4 bytes as lowercase hex (a zip starts with "504b0304").
export async function hashObject(input: { bucket: StorageBucket; key: string }): Promise<{ sha256: string; firstBytesHex: string }>;

export async function deleteObject(input: { bucket: StorageBucket; key: string }): Promise<void>;
```

Implementation rules:

1. One `S3Client`, created on first use and kept in a module variable:
   ```ts
   new S3Client({
     region: env.S3_REGION,
     endpoint: env.S3_ENDPOINT,
     forcePathStyle: env.S3_FORCE_PATH_STYLE,
     credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
     requestChecksumCalculation: "WHEN_REQUIRED",
     responseChecksumValidation: "WHEN_REQUIRED",
   });
   ```
   The two `WHEN_REQUIRED` lines are **required**. Without them, new SDK versions add checksum parameters to
   presigned URLs that the browser cannot send, and uploads to R2 fail.
2. `bucket: "private"` → `env.S3_PRIVATE_BUCKET`; `"public"` → `env.S3_PUBLIC_BUCKET`.
3. `createUploadUrl`:
   - Build `PutObjectCommand` with `Bucket`, `Key`, `ContentType`, `ContentLength: sizeBytes`, plus
     `CacheControl` when `cacheControl` is not null.
   - Call `getSignedUrl(client, command, { expiresIn, signableHeaders })`. `signableHeaders` is a `Set` of
     `"content-type"`, `"content-length"`, and `"cache-control"` when it is used.
   - Return `headers`: `{ "Content-Type": contentType }` plus `"Cache-Control": cacheControl` when used.
     Never return `Content-Length`. The browser sets it itself.
4. `createDownloadUrl`: `GetObjectCommand` on the private bucket.
   When `downloadFileName` is not null, set `ResponseContentDisposition` to `attachment; filename="<name>"`.
5. `headObject`: `HeadObjectCommand`. Return `null` when the error's `name` is `"NotFound"` or
   `$metadata.httpStatusCode` is `404`.
6. `hashObject`: `GetObjectCommand`. Pipe `Body` (a Node `Readable`) through `createHash("sha256")` and record
   the first 4 bytes while streaming.
7. Never set `ACL` (D-055). Never log keys together with signed URLs. Never log signed URLs.

### 2.2 `shared/storage/keys.ts`

```ts
export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];
export function imageExtension(type: ImageContentType): "jpg" | "png" | "webp";   // jpeg→jpg

export function themeZipPrefix(themeId: string): string;              // "theme-zips/<themeId>/"
export function newThemeZipKey(themeId: string): string;              // prefix + 16 hex + ".zip"
export function themeImagePrefix(themeId: string): string;            // "theme-images/<themeId>/"
export function newThemeImageKey(themeId: string, type: ImageContentType): string;
export function walletProofPrefix(walletPaymentId: string): string;   // "wallet-proofs/<id>/"
export function newWalletProofKey(walletPaymentId: string, type: ImageContentType): string;
```

`06-payments.md` section 7.5 uses `newWalletProofKey` and `walletProofPrefix`.

### 2.3 `shared/storage/public-url.ts`

`publicImageUrl(key: string): string` returns `${env.PUBLIC_IMAGES_BASE_URL}/${key}`.
Mappers call it to turn `ThemeImage.key` into `ThemeImageDTO.url`. The database never stores the URL (D-053).

### 2.4 `shared/storage/upload-file.ts` (browser only)

```ts
export async function uploadFile(upload: PresignedUpload, file: File, onProgress: (percent: number) => void): Promise<void>;
```

- Uses `XMLHttpRequest`, because `fetch` cannot report upload progress.
- Calls `open("PUT", upload.url)` and sets every header in `upload.headers`, then sends the `File` as the body.
- Calls `onProgress` with integers 0–100 as the upload runs.
- A 2xx status resolves. Anything else, a network error or an abort rejects with `new Error("UPLOAD_FAILED")`.
- Components then show: `"The upload failed. Please check your connection and try again."`
- It imports only the `PresignedUpload` **type** from `s3.ts` (`import type`), so no AWS code reaches the browser.

---

## 3. Theme images (admin)

Constants in `theme.constants.ts`:
- `MAX_THEME_IMAGES = 12`
- `MAX_IMAGE_BYTES = 3_145_728`
- `IMAGE_MIN_PX = 400`
- `IMAGE_MAX_PX = 6000`
- `IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable"`

Every action below starts with `requireAdmin()`. On success it revalidates `/admin/themes/<id>`, `/themes/<slug>`,
`/themes` and `/`.

### 3.1 Upload flow in `ThemeImagesManager`

1. The admin picks one file.
2. The browser reads its size with `createImageBitmap(file)`. If the width or height is outside 400–6000, the form
   shows the error and stops. The error text is in 3.3.
3. The browser calls `createImageUploadUrlAction({ themeId, contentType: file.type, sizeBytes: file.size })`.
4. The browser runs `uploadFile(...)` and shows a progress bar.
5. The browser calls `addThemeImageAction({ themeId, key, alt: "", width, height })`.

### 3.2 `createImageUploadUrl({ themeId, contentType, sizeBytes })`

| Check | Error |
|---|---|
| Theme exists | `NOT_FOUND` `"Theme not found."` |
| `images.length < 12` | `CONFLICT` `"A theme can have at most 12 images."` |
| `contentType` in `IMAGE_CONTENT_TYPES` and `sizeBytes` 1 – 3 145 728 | `INVALID` `"Please upload a JPG, PNG or WebP image up to 3 MB."` |

If every check passes, call `createUploadUrl` with:
- `bucket: "public"`
- `key: newThemeImageKey(...)`
- `cacheControl: IMAGE_CACHE_CONTROL`
- `expiresInSeconds: 600`

Then return the `PresignedUpload`.

### 3.3 `addThemeImage({ themeId, key, alt, width, height })`

| # | Check | Error |
|---|---|---|
| 1 | zod: `alt` 0–150 chars; `width`, `height` integers 400–6000 | field error on width/height: `"Images must be 400 to 6000 pixels wide and high."` |
| 2 | Theme exists | `NOT_FOUND` `"Theme not found."` |
| 3 | `key` starts with `themeImagePrefix(themeId)` and is not already in `images` | `INVALID` `"We could not find the uploaded image. Please upload it again."` |
| 4 | `headObject` is not `null` | same as 3 |
| 5 | Stored `contentType` allowed and `sizeBytes` ≤ 3 145 728 | `deleteObject`, then `INVALID` `"Please upload a JPG, PNG or WebP image up to 3 MB."` |
| 6 | Room left (atomic, see below) | `CONFLICT` `"A theme can have at most 12 images."` |

Step 6 runs as **one** update in the repository: `updateOne({ _id: themeId, "images.11": { $exists: false } }, { $push: { images } })`.
If `modifiedCount` is 0, throw the step 6 error. The new image goes to the **end** of the list.
No activity log entry.

### 3.4 Other image actions

- `removeThemeImage({ themeId, key })`
  1. The theme must exist; otherwise `NOT_FOUND` `"Theme not found."`.
  2. `key` must be in `images`; otherwise `NOT_FOUND` `"Image not found."`.
  3. If the theme's `status` is `"published"` and it has exactly 1 image, refuse with `CONFLICT` `"A published theme needs at least one image."`.
  4. Remove the image with `$pull`.
  5. After the update, call `deleteObject` on the public bucket. If the delete fails, only `console.error`; the action still succeeds.
- `reorderThemeImages({ themeId, keys })`
  1. `keys` must hold exactly the same keys as `images`: same count, no duplicates, nothing missing. Otherwise `INVALID` `"The image list changed. Please reload the page."`.
  2. Save `images` in the new order, keeping each image's `alt`, `width` and `height`.
  3. The first image is the cover.
- `updateThemeImageAlt({ themeId, key, alt })`
  1. `alt` must be 0–150 chars.
  2. The theme must exist and `key` must be in `images`. The errors are the same as for `removeThemeImage`.

---

## 4. Theme zips: creating a version (admin)

Constants in `version.constants.ts`:
- `MAX_ZIP_BYTES = 209_715_200`
- `ZIP_UPLOAD_SECONDS = 1800`
- `ZIP_SIGNATURE_HEX = "504b0304"`
- `CHANGE_TYPES = ["new", "improved", "fixed", "removed"] as const`
- `MAX_CHANGES = 50`

### 4.1 Flow in `VersionForm` (`/admin/themes/<id>/versions/new`)

The form has these fields:
- **Version** (text, placeholder shows the next patch number, e.g. `1.4.1`)
- **Changes** (rows of type select + text, add/remove row buttons, 1–50 rows)
- **Zip file**
- checkbox **"Notify owners and people who favorited this theme"** (ticked by default)

When the admin clicks **Upload and release**:

1. The browser checks that the file name ends with `.zip` (case-insensitive) and that its size is 1 – 209 715 200.
   If not, it shows the 4.2 error and stops.
2. It calls `createZipUploadUrlAction({ themeId, fileName: file.name, sizeBytes: file.size })`.
3. It runs `uploadFile(...)` and shows the progress: `"Uploading… 42%"`.
4. It calls `createVersionAction({ themeId, version, changes, notify, fileKey, originalName: file.name })`.
   While it runs, it shows `"Checking the file…"`. For a 200 MB zip this can take up to a minute because the
   server reads the whole file to compute SHA-256.
5. On success it redirects to `/admin/themes/<id>/versions` with the message
   `"Version <version> released."`, plus `" Notifications are being sent."` when `notify` was ticked.

### 4.2 `createZipUploadUrl({ themeId, fileName, sizeBytes })`

| Check | Error |
|---|---|
| Theme exists | `NOT_FOUND` `"Theme not found."` |
| `fileName` ends with `.zip` (case-insensitive), 1–200 chars; `sizeBytes` 1 – 209 715 200 | `INVALID` `"Please choose a .zip file of at most 200 MB."` |

If both checks pass, call `createUploadUrl` with:
- `bucket: "private"`
- `key: newThemeZipKey(themeId)`
- `contentType: "application/zip"`
- `cacheControl: null`
- `expiresInSeconds: 1800`

Use our own content type and ignore `file.type`, because Windows browsers send `application/x-zip-compressed`.

### 4.3 `createVersion(input, adminUserId)` — `version.service.ts`

Input (zod, `createVersionSchema`):

| Field | Rule | Field error |
|---|---|---|
| `themeId` | string | — |
| `version` | `semver` format (`03-data-model.md` section 1) | `"Use a version like 1.4.0."` |
| `changes` | 1–50 items; each `type` in `CHANGE_TYPES`, `text` 2–200 chars | `"Add between 1 and 50 changes."` / `"Each change needs 2 to 200 characters."` |
| `notify` | boolean | — |
| `fileKey` | string, 1–300 chars | — |
| `originalName` | string, 1–200 chars | — |

Steps (checks first, nothing is written until step 4):

| # | Step | Error |
|---|---|---|
| 1 | Theme exists (through the themes service) | `NOT_FOUND` `"Theme not found."` |
| 2 | If the theme has a `latestVersion`, `compareSemver(input.version, latestVersion.version) > 0` | `CONFLICT` `"The version must be higher than <latest>."` (e.g. `"The version must be higher than 1.4.0."`) |
| 3 | `checkUploadedZip(themeId, fileKey)` from `version-upload.service.ts` (below) returns `{ sizeBytes, sha256 }` | errors below |
| 4 | **Transaction** (`03-data-model.md` section 19 "Admin creates a version"): insert version with `releasedAt = now()`, `notifyRequested = notify`; themes service `setLatestVersion(themeId, { versionId, version, releasedAt }, session)`; if `notify`: notifications service `createVersionReleasedJob({ themeId, versionId, createdByUserId }, session)` and set `notificationJobId`; `activityService.log({ action: "version_released", actorRole: "admin", actorUserId, targetType: "theme", targetId: themeId, summary: "Version released: <Theme name> <version>" }, session)` | duplicate key on `{ themeId, version }` → `CONFLICT` `"Version <version> already exists for this theme."`; duplicate key on `file.key` → `CONFLICT` `"This file is already used by another version. Please upload it again."` |
| 5 | Return `VersionAdminDTO` | — |

`checkUploadedZip(themeId, fileKey)`:

1. `fileKey` must start with `themeZipPrefix(themeId)`. Otherwise `INVALID`
   `"We could not find the uploaded file. Please upload it again."`.
2. No version may already use `fileKey` (`versionRepository.existsByFileKey`). Otherwise `CONFLICT`
   `"This file is already used by another version. Please upload it again."`.
3. `headObject({ bucket: "private", key: fileKey })` must not be `null`. Otherwise the same error as in check 1.
4. `sizeBytes` must be 1 – 209 715 200. Otherwise call `deleteObject`, then throw `INVALID`
   `"Please choose a .zip file of at most 200 MB."`.
5. Run `hashObject`. If `firstBytesHex` is not `"504b0304"`, call `deleteObject`, then throw `INVALID`
   `"This file is not a valid .zip file."`.
6. Return `{ sizeBytes, sha256 }`.

The slow steps (HEAD and hashing) run **before** the transaction, never inside it.
We do not open the zip to check its contents (no zip library, `02-architecture.md` section 1). The admin is
responsible for uploading a correct WordPress theme.

`VersionAdminDTO`:

```ts
{
  id: string;
  version: string;
  releasedAt: Date;
  changes: { type: ChangeType; text: string }[];
  sizeBytes: number;
  sha256: string;
  originalName: string;
  notifyRequested: boolean;
}
```

The admin version list shows `sha256`, so the owner can compare it with `shasum -a 256 file.zip` on their computer.

### 4.4 `updateVersionChanges({ versionId, changes }, adminUserId)`

- Same `changes` rules as above.
- If the version is not found, throw `NOT_FOUND` `"Version not found."`.
- Only `changes` is updated. There are no notifications and no activity log entry (`03-data-model.md` section 6).

### 4.5 `shared/lib/semver.ts`

`compareSemver(a: string, b: string): -1 | 0 | 1` compares major, then minor, then patch **as numbers**
(`1.10.0` > `1.9.0`). Both inputs must already match the `semver` format.

---

## 5. Reading versions (store and account)

`version.service.ts`:

- `listVersionsForTheme(themeId): Promise<VersionDTO[]>` returns the newest first (by `releasedAt` descending).
  The theme page Changelog tab and My Themes use it.
  `VersionDTO = { id: string; version: string; releasedAt: Date; changes: ...; sizeBytes: number }`.
- `getVersionForDownload(versionId): Promise<{ id: string; themeId: string; version: string; fileKey: string } | null>`.
  Only the downloads service uses it.

`fileKey` never leaves the server. Only `getVersionForDownload` returns it, and only to `download.service.ts`.

---

## 6. Wallet proof screenshots

Upload and submit are in `06-payments.md` section 7.5, using `newWalletProofKey`, `createUploadUrl` with these values:
- `bucket: "private"`
- `cacheControl: null`
- `expiresInSeconds: 600`

The submit check uses `headObject` too.

**Admin view** (D-104): `/admin/wallet-payments/[id]` shows the screenshot in an `<img>` whose `src` is
`createDownloadUrl({ key: proof.key, expiresInSeconds: 300, downloadFileName: null })`.
The page gets this URL from `getWalletPaymentForAdmin` in the wallet-payments service. Proofs are never deleted.

---

## 7. Downloads

### 7.1 `createDownloadLink({ userId, versionId }): Promise<{ url: string }>` — `download.service.ts`

No transaction (`03-data-model.md` section 19).

| # | Step | Error |
|---|---|---|
| 1 | `versionId` is a valid ObjectId and `getVersionForDownload` returns a version | `NOT_FOUND` `"This file does not exist."` |
| 2 | Ownerships service `hasActiveOwnership(userId, version.themeId)` is `true` (the **only** access rule, `03-data-model.md` section 8; works for unpublished themes too, D-016) | `FORBIDDEN` `"You do not own this theme."` |
| 3 | `downloadLogRepository.countForUserSince(userId, now() − 60 min)` < `DOWNLOADS_PER_HOUR` (30, D-057) | `RATE_LIMITED` `"You downloaded too many files in the last hour. Please try again later."` |
| 4 | Insert `downloadLogs` `{ userId, themeId, versionId }`; themes service `incrementDownloadCount(themeId)` (`$inc`) | — |
| 5 | Theme slug from the themes service. Return `createDownloadUrl({ key: fileKey, expiresInSeconds: 300, downloadFileName: "<slug>-<version>.zip" })` | — |

Admins are **not** an exception. To test a download, the owner grants the theme to their own account.

### 7.2 Route `app/api/downloads/[versionId]/route.ts`

This is the complete file. The agent copies it exactly.

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

`download.constants.ts`:

```ts
export const DOWNLOAD_ERROR_PARAMS: Record<AppErrorCode, string> = {
  NOT_FOUND: "not_found", FORBIDDEN: "not_owned", RATE_LIMITED: "rate_limited", CONFLICT: "failed", INVALID: "failed",
};
export const DOWNLOAD_ERROR_MESSAGES: Record<string, string> = {
  not_found: "This file does not exist.",
  not_owned: "You do not own this theme.",
  rate_limited: "You downloaded too many files in the last hour. Please try again later.",
  failed: "The download could not start. Please try again.",
};
```

`/account/themes` shows `DOWNLOAD_ERROR_MESSAGES[downloadError]` in a danger `Alert` when the param is one of
these keys. It ignores any other value.

### 7.3 `DownloadButton`

- Renders a plain `<a href="/api/downloads/<versionId>" rel="nofollow">` styled with the `Button` UI kit variant.
- **Never** use Next.js `<Link>` for it. `<Link>` prefetches, and every prefetch would count as a download.
- It is used on My Themes (latest and older versions), the checkout success page and the approved wallet payment page.
- Emails never link to `/api/downloads/...`. They link to `/account/themes`.

---

## 8. Changing provider later

Only the env values in `02-architecture.md` section 10 change. No code changes and no database changes (D-051, D-053).
Existing files must be copied to the new provider first, for example with `rclone sync`.

---

## 9. Cloudflare R2 setup (owner, one time per environment)

Do this once for **production**. For **staging**, repeat it with the bucket names `staging-store-files` and
`staging-store-images`.

1. **Account.** Create a Cloudflare account, open **R2 Object Storage** and enable it. Cloudflare asks for a payment
   card, but the free tier covers the launch: 10 GB storage, 1M writes and 10M reads per month, and downloads are always free.
2. **Buckets.** Create `store-files` and `store-images`.
   - Location: **Automatic**, with the location hint **Eastern Europe (EEUR)**, which is closest to the VPS and to Egypt.
   - Storage class: **Standard**.
3. **Public images.** Open `store-images` → **Settings** → **Custom Domains** → **Connect domain** → `images.<your domain>`.
   - The domain must use Cloudflare DNS (O-003).
   - Set `PUBLIC_IMAGES_BASE_URL=https://images.<your domain>`.
   - **Before you own a domain (staging only):** enable **Public Development URL (r2.dev)** on the bucket and use that URL.
     Cloudflare rate-limits `r2.dev`, so never use it in production.
4. **Private files.** On `store-files`, connect **no** custom domain and **keep r2.dev disabled**.
5. **CORS** (needed for browser uploads). On **both** buckets go to **Settings** → **CORS policy** and paste the
   following, using the exact `APP_URL` value (no trailing slash):
   ```json
   [
     {
       "AllowedOrigins": ["https://<APP_URL host>"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type", "cache-control"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   Downloads and `<img>` tags do not need CORS.
6. **API token.** Go to **R2** → **Manage API tokens** → **Create Account API token**.
   - Permission: **Object Read & Write**.
   - Scope: **Apply to specific buckets only**, then pick the two buckets of this environment.
   - Copy the **Access Key ID** and **Secret Access Key** into the env. They are shown only once.
7. **Env values** (production example):
   ```
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_FORCE_PATH_STYLE=false
   S3_ACCESS_KEY_ID=<from step 6>
   S3_SECRET_ACCESS_KEY=<from step 6>
   S3_PRIVATE_BUCKET=store-files
   S3_PUBLIC_BUCKET=store-images
   PUBLIC_IMAGES_BASE_URL=https://images.<your domain>
   ```
   `<ACCOUNT_ID>` is shown on the R2 overview page.
8. **Check.** In the admin panel, upload one image and one zip. Grant the theme to yourself and download it.
   Confirm the downloaded file's SHA-256 equals the one on the admin version list.
9. **Spending alert (optional).** Under **Billing** → **Notifications**, add a usage alert, for example at $5.

---

## 10. Local development, E2E and CI (MinIO)

`docker-compose.yml` has these two services, next to MongoDB. T-001 pins the image tags.

```yaml
  minio:
    image: minio/minio:<pinned in T-001>
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes: ["minio-data:/data"]
  minio-init:
    image: minio/mc:<pinned in T-001>
    depends_on: [minio]
    entrypoint: >
      /bin/sh -c "until mc alias set local http://minio:9000 minioadmin minioadmin; do sleep 1; done;
      mc mb --ignore-existing local/store-files;
      mc mb --ignore-existing local/store-images;
      mc anonymous set download local/store-images"
```

`.env.example` local values:

```
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_PRIVATE_BUCKET=store-files
S3_PUBLIC_BUCKET=store-images
PUBLIC_IMAGES_BASE_URL=http://localhost:9000/store-images
```

MinIO accepts browser uploads from any origin by default, so it needs no CORS setup. The MinIO console runs at
`http://localhost:9001`.

`S3_ENDPOINT` is **required** in `env.ts` (a non-empty URL), because both R2 and MinIO need it.

---

## 11. Required tests

The task files copy these. `FakeStorage` must also provide `putTestObject({ bucket, key, contentType, body })`.
`hashObject` on the fake computes the **real** SHA-256 of `body`.

**`theme-image.service.test.ts`**
- `createImageUploadUrl` › refuses a GIF → `INVALID` `"Please upload a JPG, PNG or WebP image up to 3 MB."`
- `createImageUploadUrl` › refuses a 13th image → `CONFLICT` `"A theme can have at most 12 images."`
- `createImageUploadUrl` › returns a key under `theme-images/<themeId>/` and a `Cache-Control` header
- `addThemeImage` › refuses a key of another theme → `INVALID` "could not find" message; `images` still empty
- `addThemeImage` › refuses when the object is missing in storage → same message
- `addThemeImage` › deletes and refuses a stored object over 3 MB → message; object gone from `FakeStorage.objects`
- `addThemeImage` › adds the image at the end with alt, width and height
- `removeThemeImage` › refuses removing the only image of a published theme → `CONFLICT` message; image still there
- `removeThemeImage` › removes from the database and deletes the object
- `reorderThemeImages` › refuses a list with a missing key → `INVALID` message; order unchanged
- `reorderThemeImages` › saves the new order and keeps alt, width and height

**`version.service.test.ts`**
- `createZipUploadUrl` › refuses a file not ending in `.zip` and a file over 209 715 200 bytes → message
- `createVersion` › refuses a version not higher than the latest (`1.4.0` after `1.4.0`, `1.3.9` after `1.4.0`) → `CONFLICT` message; 1 version in DB
- `createVersion` › accepts `1.10.0` after `1.9.0`
- `createVersion` › refuses a file key of another theme → `INVALID` message; 0 versions
- `createVersion` › deletes and refuses a file that does not start with the zip signature → message; object gone; 0 versions
- `createVersion` › stores the real SHA-256 and size of the uploaded file
- `createVersion` › updates `theme.latestVersion`, logs `version_released`
- `createVersion` › with `notify` creates one `version_released` job and sets `notificationJobId`; without `notify` creates none
- `createVersion` › refuses a file key already used by another version → `CONFLICT` message
- `updateVersionChanges` › changes only `changes`; no job, no log

**`semver.test.ts`**
- `compareSemver` › compares numbers, not text (`1.10.0` > `1.9.0`); equal → 0

**`download.service.test.ts`** (time fixed with `setTestNow`)
- refuses a user without ownership → `FORBIDDEN` `"You do not own this theme."`; 0 download logs; `downloadCount` 0
- refuses a revoked ownership → same
- allows an owner of an **unpublished** theme
- refuses an invalid or unknown version id → `NOT_FOUND` `"This file does not exist."`
- the 31st download within 60 minutes → `RATE_LIMITED` message; still 30 logs
- a download 61 minutes after 30 others is allowed
- success → 1 log row with user, theme and version; `downloadCount` = 1; URL from `FakeStorage` contains the key
  and the file name `<slug>-<version>.zip`

The route file itself has no unit test (it would need to mock our own session helper). E2E flow 2 covers it: no
session → login, owner → file downloads.

**E2E** (`10-testing.md` section 8, against MinIO): flows 2, 3 and 4 upload and download **real** files. Flow 4
uploads a real small zip through the admin form.
