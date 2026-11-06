# T-006: Storage module and theme images (upload, remove, reorder, alt text)

- Depends on: T-005
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2, 3, 5, 6, 9, 10; `docs/03-data-model.md` section 5;
  `docs/07-delivery-updates.md` sections 1, 2, 3, 10, 11 (theme-images part); `docs/01-decisions.md` D-049, D-051, D-053 – D-059;
  `docs/05-pages.md` section 5 (`/admin/themes` and `/admin/themes/[id]` rows); `docs/10-testing.md` sections 2 – 4.
  Copy the structure of `src/features/themes` (T-004) and the forms of `ThemeForm.tsx`.

Sections that contain `[PLANNER: ...]` are **not decided yet**. Build everything else, do not guess the marked part,
and add the question to `docs/QUESTIONS.md` (AGENTS.md rule).

## Goal

The storage module (the only code that talks to S3 / R2 / MinIO) and the admin theme images: pick a file, upload it
**directly from the browser** to the public bucket, save it on the theme, remove it, reorder it, change its alt text.

**Not in this task:** zips and versions (T-008), wallet proof screenshots (later task), downloads (T-009), the publish
checklist and publishing (T-010). Section 9 of `07` (Cloudflare R2 setup) is owner work: nothing to build. The MinIO
service, the buckets and the S3 env variables already exist from T-001: do not change `docker-compose.yml`, `.env.example`,
`env.ts` or `next.config.ts`.

## Packages

`@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`, major 3 (02 §1). Run `npm view @aws-sdk/client-s3@3 version`
and `npm view @aws-sdk/s3-request-presigner@3 version`, pin the newest 3.x of each **exactly** (no `^`), and use the same
version for both. Update `pnpm-lock.yaml`. Nothing else.

## Files

```
src/shared/storage/s3.ts                07 §2.1. The ONLY file that imports @aws-sdk/*.
src/shared/storage/keys.ts              07 §2.2
src/shared/storage/upload-file.ts       07 §2.4 (browser only). (public-url.ts already exists: do not change it)
src/shared/storage/s3.test.ts / keys.test.ts

src/shared/test/fakes/fake-storage.ts   FakeStorage (below)
src/shared/test/fakes/fake-storage.test.ts
src/shared/test/setup.ts                (change) register the fake the same way FakeEmailSender is registered; reset it beforeEach

src/shared/ui/FileField.tsx             label + file input (below)
src/shared/ui/ProgressBar.tsx           (below)

src/features/themes/theme.constants.ts  (change) add the image constants (below)
src/features/themes/theme.types.ts      (change) ThemeAdminImageDTO; images in ThemeAdminDTO; coverImage in ThemeAdminListItemDTO
src/features/themes/theme.mapper.ts     (change) fill those fields
src/features/themes/theme.mapper.test.ts (change) append the 2 tests listed below; do not touch the existing tests
src/features/themes/theme.repository.ts (change) add pushThemeImage, pullThemeImage, replaceThemeImages, setThemeImageAlt
src/features/themes/theme-image.service.ts
src/features/themes/theme-image.schemas.ts
src/features/themes/theme-image.actions.ts
src/features/themes/theme-image.service.test.ts / theme-image.schemas.test.ts
src/features/themes/components/admin/ThemeImagesManager.tsx   ("use client")
src/features/themes/components/admin/ThemeImageRow.tsx        ("use client")
src/features/themes/components/admin/useThemeImageUpload.ts   (hook, "use client")
src/features/themes/components/admin/ThemeTable.tsx           (change) add the cover column

src/app/admin/themes/[id]/page.tsx      (change) show ThemeImagesManager below ThemeForm
e2e/helpers.ts                          (change) add createPngFile(width, height) (below)
e2e/theme-images.spec.ts
```

## `s3.ts`, `keys.ts`, `upload-file.ts`

Write them **exactly** as `07 §2.1` (signatures and implementation rules 1–7, including the two `WHEN_REQUIRED`
checksum options), `07 §2.2` and `07 §2.4`. Extra details the doc leaves to the code:
- `hashObject` needs a Node `Readable`: if `response.Body` is not an instance of `Readable` (from `node:stream`), throw `new Error("STORAGE_BODY_NOT_STREAM")`.
- `keys.ts` uses `randomBytes(8).toString("hex")` from `node:crypto`; `imageExtension("image/jpeg")` is `"jpg"`.
- Never log keys together with signed URLs, and never log signed URLs.

### Fake (`fake-storage.ts`)

Same five functions as `s3.ts`, as methods of a class `FakeStorage`, plus one shared instance `export const fakeStorage = new FakeStorage()`.
Import the types with `import type { createUploadUrl, createDownloadUrl, StorageBucket, PresignedUpload, StoredObjectInfo } from "@/shared/storage/s3"`
and build the input types with `Parameters<typeof createUploadUrl>[0]` (no new exports in `s3.ts`).

```ts
export type FakeStoredObject = { bucket: StorageBucket; key: string; contentType: string; sizeBytes: number; body: Buffer };
class FakeStorage {
  objects: Map<string, FakeStoredObject>;      // map key = `${bucket}/${key}`, e.g. "public/theme-images/abc/1.png"
  uploadUrlRequests: CreateUploadUrlInput[];   // every createUploadUrl input, in order
  downloadUrlRequests: CreateDownloadUrlInput[];
  putTestObject(input: { bucket: StorageBucket; key: string; contentType: string; body: Buffer | string }): void; // sizeBytes = body length
  failNextDelete(error: Error): void;          // the next deleteObject call throws this error
  reset(): void;                               // clears objects, both request lists and the queued delete error
}
```
Behaviour:
- `createUploadUrl` records the input and returns `{ key: input.key, url: "https://fake-storage.test/<bucket>/<key>?upload=1", headers }` where `headers` is
  `{ "Content-Type": contentType }` plus `"Cache-Control": cacheControl` when `cacheControl` is not `null` (same as `07 §2.1` rule 3).
- `createDownloadUrl` records the input and returns `"https://fake-storage.test/private/<key>?expires=<expiresInSeconds>"`, plus `"&filename=" + encodeURIComponent(downloadFileName)` when it is not `null`.
- `headObject` returns `{ sizeBytes, contentType }` of the stored object, or `null` when it is not there.
- `hashObject` returns the **real** SHA-256 (lowercase hex, `node:crypto`) of `body` and the first 4 bytes as lowercase hex (`firstBytesHex`);
  a missing object throws `new Error("FAKE_STORAGE_OBJECT_NOT_FOUND")`.
- `deleteObject` removes the object; deleting a missing object is not an error. It throws the queued error from `failNextDelete` once.

`setup.ts`: `vi.mock("@/shared/storage/s3", () => ({ createUploadUrl: ..., createDownloadUrl: ..., headObject: ..., hashObject: ..., deleteObject: ... }))`,
each calling the matching method of `fakeStorage` (same pattern as the existing email mock); call `fakeStorage.reset()` in the existing `beforeEach`.

## UI kit additions (`shared/ui`, visual classes allowed here)

- `FileField.tsx`: props `{ label: string; name: string; accept?: string; disabled?: boolean; hint?: string; errors?: string[]; id?: string; onChange?: (file: File | null) => void }`.
  Same layout, `useId`, label, hint and error handling as `TextField.tsx`. The input is `<input type="file">`; `onChange` calls `props.onChange?.(event.target.files?.[0] ?? null)`.
- `ProgressBar.tsx`: props `{ percent: number; label: string }`. Renders `<progress value={percent} max={100} aria-label={label} className="accent-primary h-2 w-full" />`.

## Constants (`theme.constants.ts`, add)

```ts
export const MAX_IMAGE_BYTES = 3_145_728;
export const IMAGE_MIN_PX = 400;
export const IMAGE_MAX_PX = 6000;
export const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const IMAGE_UPLOAD_SECONDS = 600;
```
(`MAX_THEME_IMAGES = 12` and `IMAGE_ALT_MAX = 150` already exist.)

## Service (`theme-image.service.ts`)

Use `themeRepository.findThemeById` for "theme exists". Storage calls go through `@/shared/storage/s3`. No transaction.
Messages are copied from 07 §3; the two "could not find" cases use the same text.

| Function | Rules / errors, **in this order** |
|---|---|
| `createImageUploadUrl({ themeId, contentType, sizeBytes }): Promise<PresignedUpload>` | 1 theme exists, else NOT_FOUND `"Theme not found."`. 2 `images.length < 12`, else CONFLICT `"A theme can have at most 12 images."`. 3 `contentType` is one of `IMAGE_CONTENT_TYPES` and `sizeBytes` is 1 – 3 145 728, else INVALID `"Please upload a JPG, PNG or WebP image up to 3 MB."`. Then `createUploadUrl({ bucket: "public", key: newThemeImageKey(themeId, contentType), contentType, sizeBytes, cacheControl: IMAGE_CACHE_CONTROL, expiresInSeconds: IMAGE_UPLOAD_SECONDS })` and return its result. |
| `addThemeImage({ themeId, key, alt, width, height }): Promise<void>` | 1 theme exists (NOT_FOUND `"Theme not found."`). 2 `key` starts with `themeImagePrefix(themeId)` and is not already in `images`, else INVALID `"We could not find the uploaded image. Please upload it again."`. 3 `headObject({ bucket: "public", key })` is not `null`, else the same INVALID. 4 stored `contentType` is allowed and stored `sizeBytes` ≤ 3 145 728, else `deleteObject({ bucket: "public", key })` and INVALID `"Please upload a JPG, PNG or WebP image up to 3 MB."`. 5 `themeRepository.pushThemeImage` returns `true`, else CONFLICT `"A theme can have at most 12 images."`. The new image is saved at the **end** of the list. No activity log entry. |
| `removeThemeImage({ themeId, key }): Promise<void>` | 1 theme exists (NOT_FOUND `"Theme not found."`). 2 `key` is in `images`, else NOT_FOUND `"Image not found."`. 3 `status` is `"published"` and `images.length` is 1 → CONFLICT `"A published theme needs at least one image."`. 4 `pullThemeImage`. 5 after the update, `deleteObject({ bucket: "public", key })`; if it throws, only `console.error("removeThemeImage: could not delete the stored image")` (no key, no URL) and the function still succeeds. |
| `reorderThemeImages({ themeId, keys }): Promise<void>` | 1 theme exists. 2 `keys` has exactly the same keys as `images`: same count, no duplicates, nothing missing, else INVALID `"The image list changed. Please reload the page."`. 3 `replaceThemeImages` with the images in the order of `keys`, each keeping its `alt`, `width` and `height`. The first image is the cover. |
| `updateThemeImageAlt({ themeId, key, alt }): Promise<void>` | theme exists (NOT_FOUND `"Theme not found."`); `key` is in `images` (NOT_FOUND `"Image not found."`); `setThemeImageAlt`. |

Repository functions (in `theme.repository.ts`, each calls `connectDB()` first, `toObjectId` for the theme id):
- `pushThemeImage(themeId, image): Promise<boolean>`: ONE `ThemeModel.updateOne({ _id, [`images.${MAX_THEME_IMAGES - 1}`]: { $exists: false } }, { $push: { images: image } })`; returns `modifiedCount === 1`. This is the atomic "room left" check of 07 §3.3.
- `pullThemeImage(themeId, key)`: `$pull: { images: { key } }`.
- `replaceThemeImages(themeId, images)`: `$set: { images }`.
- `setThemeImageAlt(themeId, key, alt)`: `updateOne({ _id, "images.key": key }, { $set: { "images.$.alt": alt } })`.
`image` is `{ key: string; alt: string; width: number; height: number }`.

## Schemas (`theme-image.schemas.ts`)

Inputs of the actions (all objects, validated with `safeParse` on `unknown`):
- `createImageUploadUrlSchema`: `{ themeId: string, contentType: string, sizeBytes: number }`.
- `addThemeImageSchema`: `themeId` string, `key` string, `alt` string 0–150 chars, `width` and `height` integers 400–6000.
  Message of `width` and `height` (both): `"Images must be 400 to 6000 pixels wide and high."`.
  Message of `alt` too long: `[PLANNER: error text for an alt text over 150 characters — 07 gives none]`.
- `removeThemeImageSchema`: `{ themeId, key }`. `reorderThemeImagesSchema`: `{ themeId, keys: string[] }`.
- `updateThemeImageAltSchema`: `{ themeId, key, alt }` (same `alt` rule and message as above).
Export the input types (`AddThemeImageInput`, ...) with `z.output`, named like `ThemeInput`.

## Actions (`theme-image.actions.ts`)

`createImageUploadUrlAction`, `addThemeImageAction`, `removeThemeImageAction`, `reorderThemeImagesAction`,
`updateThemeImageAltAction`. They take **one argument of type `unknown`** (they are called from client code, not from a `<form>`),
and return `Promise<ActionResult<...>>`. Pattern (02 §5.5): `requireAdmin()` → `safeParse` (failure: `validationFailure(parsed.error, {})`)
→ service in try/catch (`failureFrom(error, "<actionName>", {})`) → revalidate → `{ ok: true, data }`.
`createImageUploadUrlAction` returns `ActionResult<PresignedUpload>` (`import type { PresignedUpload } from "@/shared/storage/s3"`); the others `data: undefined`.
After success every action revalidates: `/admin/themes/[id]` (page), `/themes/[slug]` (page), `/themes` and `/`.

## Admin screens

`ThemeAdminDTO` gets `images: ThemeAdminImageDTO[]` where `ThemeAdminImageDTO = ThemeImageDTO & { key: string }` (the admin needs the key).
`ThemeAdminListItemDTO` gets `coverImage: ThemeImageDTO | null` (first image or `null`, URL from `publicImageUrl`).

`/admin/themes` table: new column "Cover" as the **first** column: the cover in `<div className="w-16"><ImageFrame ... sizes="64px" /></div>`, or "—" when `null`.

`/admin/themes/[id]`: below `ThemeForm`, add `ThemeImagesManager` with props `themeId` and `images`. Nothing else changes on that page.

`ThemeImagesManager` (client) lists the images and holds the add control; `ThemeImageRow` (client) is one image with its buttons;
`useThemeImageUpload(themeId)` is the hook with the upload steps (02 §9.5). Flow of the hook (07 §3.1):
1. Read the size with `createImageBitmap(file)`, then `bitmap.close()`. If it cannot be read: error `[PLANNER: see UI wording]`.
2. Width or height outside 400–6000 → error `"Images must be 400 to 6000 pixels wide and high."` and stop.
3. `createImageUploadUrlAction({ themeId, contentType: file.type, sizeBytes: file.size })`. On `ok: false` show `result.error` and stop.
4. `uploadFile(result.data, file, setPercent)` with a `ProgressBar`. On rejection show `"The upload failed. Please check your connection and try again."` and stop.
5. `addThemeImageAction({ themeId, key: result.data.key, alt: "", width, height })`. On `ok: false` show `result.error`.
All actions are called inside a transition; buttons are disabled while one runs. Errors show in a `FormError`.
After a successful action the page data refreshes by itself (the action revalidates the page).

`[PLANNER: the docs describe the flow of the images screen but give no wording or layout. The text below is a PROPOSAL, not approved. Do not build the screen until the marker is removed.]`
- `Heading level 2` "Images"; `Text tone muted` "The first image is the cover. Up to 12 images, JPG, PNG or WebP, 3 MB each, 400 to 6000 pixels."
- `FileField` label "Add an image", `accept="image/jpeg,image/png,image/webp"`, selecting a file starts the upload at once; while uploading show the `ProgressBar` (label "Uploading image") and `Text` "Uploading… <percent>%". After a finished upload the field is reset (give it a new `key`).
- Message when the image cannot be read by the browser: `"Please upload a JPG, PNG or WebP image up to 3 MB."`.
- Each image (n = 1, 2, …) in a `Card`: `ImageFrame` (alt = its alt text), `Badge` "Cover" on the first one, a small form with `TextField` label `"Alt text for image n"` and `Button type="submit" size="sm" variant="secondary"` with the text
  `"Save alt text for image n"`, `Button` `"Move image n up"` (disabled for the first), `"Move image n down"` (disabled for the last), `Button variant="danger"` `"Remove image n"`.
- No images: `Text` "No images yet."

## e2e helper (`createPngFile`)

Add to `e2e/helpers.ts` exactly:

```ts
import { crc32, deflateSync } from "node:zlib";

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

// A plain white PNG of the given size: a real image that the browser can decode.
export function createPngFile(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 255)]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
```

## Required tests

`src/shared/storage/s3.test.ts` (offline: signing needs no network; load the real module with
`const s3 = await vi.importActual<typeof import("@/shared/storage/s3")>("@/shared/storage/s3")`, because `setup.ts` mocks it)
- [ ] createUploadUrl › signs content type, length and cache control for the public bucket → `new URL(result.url)`: host `localhost:9000`, pathname `/store-images/theme-images/abc/x.png`, `X-Amz-Expires` `"600"`, `X-Amz-SignedHeaders` (split by `;`) contains `content-type`, `content-length` and `cache-control`; `result.headers` equals `{ "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" }`; `result.key` is the given key; no query parameter name starts with `x-amz-checksum` or `x-amz-sdk-checksum` (compare lowercase). If `content-length` is not signed, stop and add a question.
- [ ] createUploadUrl › leaves out cache control when it is null → `result.headers` equals `{ "Content-Type": "application/zip" }`; `X-Amz-SignedHeaders` does not contain `cache-control`; pathname starts with `/store-files/` for `bucket: "private"`
- [ ] createDownloadUrl › sets the file name and expiry → private bucket path `/store-files/<key>`, `X-Amz-Expires` `"300"`, `response-content-disposition` equals `attachment; filename="aurora-1.0.0.zip"`; with `downloadFileName: null` there is no `response-content-disposition`

`src/shared/storage/keys.test.ts`
- [ ] newThemeImageKey › builds `theme-images/<themeId>/<16 hex>.<ext>` → `image/jpeg` ends `.jpg`, `image/png` `.png`, `image/webp` `.webp`; the 16 characters match `^[0-9a-f]{16}$`
- [ ] keys › every call gives a new key → two calls of `newThemeZipKey("abc")` differ; the key matches `^theme-zips/abc/[0-9a-f]{16}\.zip$`
- [ ] prefixes › `themeZipPrefix("abc")` is `"theme-zips/abc/"`, `themeImagePrefix("abc")` is `"theme-images/abc/"`, `walletProofPrefix("abc")` is `"wallet-proofs/abc/"`; `newWalletProofKey("abc", "image/png")` matches `^wallet-proofs/abc/[0-9a-f]{16}\.png$`

`src/shared/test/fakes/fake-storage.test.ts`
- [ ] FakeStorage › headObject returns null for a missing object and the size and type of a stored one
- [ ] FakeStorage › hashObject returns the real SHA-256 and the first 4 bytes → body `"PK\u0003\u0004abc"` gives `firstBytesHex "504b0304"` and the SHA-256 computed in the test with `node:crypto`
- [ ] FakeStorage › deleteObject removes the object and `failNextDelete` makes the next delete throw once
- [ ] FakeStorage › reset clears objects and recorded requests

`theme-image.service.test.ts` (real in-memory MongoDB, `fakeStorage`; helpers: `createTheme` from factories with `images`, `fakeStorage.putTestObject`)
- [ ] createImageUploadUrl › refuses a GIF → INVALID `"Please upload a JPG, PNG or WebP image up to 3 MB."`; `uploadUrlRequests` is empty
- [ ] createImageUploadUrl › refuses a file over 3 MB and an empty file → same INVALID for `sizeBytes 3145729` and for `0`
- [ ] createImageUploadUrl › refuses a 13th image → CONFLICT `"A theme can have at most 12 images."` (theme with 12 images)
- [ ] createImageUploadUrl › refuses an unknown theme → NOT_FOUND `"Theme not found."`
- [ ] createImageUploadUrl › returns a key under `theme-images/<themeId>/` and a Cache-Control header → `result.key` matches `^theme-images/<themeId>/[0-9a-f]{16}\.png$`; `result.headers` equals `{ "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" }`; `uploadUrlRequests` equals `[{ bucket: "public", key: result.key, contentType: "image/png", sizeBytes: 1000, cacheControl: "public, max-age=31536000, immutable", expiresInSeconds: 600 }]`
- [ ] addThemeImage › refuses a key of another theme → INVALID `"We could not find the uploaded image. Please upload it again."`; `images` still `[]`
- [ ] addThemeImage › refuses a key that is already in the list → same INVALID; still 1 image
- [ ] addThemeImage › refuses when the object is missing in storage → same INVALID; `images` still `[]`
- [ ] addThemeImage › deletes and refuses a stored object over 3 MB → INVALID `"Please upload a JPG, PNG or WebP image up to 3 MB."`; `fakeStorage.objects.has("public/<key>")` is `false`; `images` still `[]`
- [ ] addThemeImage › deletes and refuses a stored object of another type → stored as `image/gif`: same INVALID; object gone
- [ ] addThemeImage › adds the image at the end with alt, width and height → theme with 1 image; after the call 2 images, the new one last with `alt "Hero"`, `width 1200`, `height 800`
- [ ] addThemeImage › refuses a 13th image even when the check before was passed → theme with 12 images, object stored: CONFLICT `"A theme can have at most 12 images."`; still 12 images
- [ ] removeThemeImage › refuses removing the only image of a published theme → CONFLICT `"A published theme needs at least one image."`; image still there; object still stored
- [ ] removeThemeImage › allows removing the only image of a draft theme → `images []`
- [ ] removeThemeImage › removes from the database and deletes the object → 1 of 2 images left (the other one); object gone from `fakeStorage.objects`
- [ ] removeThemeImage › refuses an unknown key → NOT_FOUND `"Image not found."`; images unchanged
- [ ] removeThemeImage › still succeeds when deleting the object fails → `fakeStorage.failNextDelete(new Error("boom"))`; call resolves; image removed from the database; `console.error` spy called once
- [ ] reorderThemeImages › refuses a list with a missing key → INVALID `"The image list changed. Please reload the page."`; order unchanged
- [ ] reorderThemeImages › refuses a list with a duplicate key and the same length → same INVALID; order unchanged
- [ ] reorderThemeImages › saves the new order and keeps alt, width and height → 3 images reversed; each keeps its own `alt`, `width`, `height`; the first is the new cover
- [ ] updateThemeImageAlt › changes only the alt of that image → other images and their alts unchanged
- [ ] updateThemeImageAlt › refuses an unknown key → NOT_FOUND `"Image not found."`

`theme-image.schemas.test.ts`
- [ ] addThemeImageSchema › accepts 400 and 6000 and refuses 399 and 6001 pixels → message `"Images must be 400 to 6000 pixels wide and high."` on `width` and on `height`
- [ ] addThemeImageSchema › refuses a decimal width such as `800.5`
- [ ] addThemeImageSchema › `[PLANNER: test for the alt text over 150 characters]` (an alt of exactly 150 characters is accepted)

`theme.mapper.test.ts` (append)
- [ ] toThemeAdminDTO › lists the images with key, URL, alt, width and height
- [ ] toThemeAdminListItemDTO › has the first image as `coverImage` and `null` without images

`e2e/theme-images.spec.ts` (needs MongoDB and MinIO from docker compose; `[PLANNER]` wording above must be decided first)
Seed in `beforeAll` (`mongoose.connect(readMongoUri())`, `removeAdminAccount()`): one category and two **draft** themes with `ThemeModel.create`
(`Imaged Aurora <RUN_ID>` and `Small Aurora <RUN_ID>`, valid fields as in `catalog.spec.ts`). Create the admin once with `registerAs` on a page from the `browser` fixture.
`afterAll`: delete the themes and the category (slug regex `<RUN_ID>`), `mongoose.disconnect()`.
- [ ] admin uploads two images, reorders them and removes one → `loginAs`; open `/admin/themes/<id>`; `getByLabel("Add an image").setInputFiles({ name: "first.png", mimeType: "image/png", buffer: createPngFile(800, 600) })`; "Alt text for image 1" is visible and the `Cover` badge appears once; `ThemeModel.findById` has 1 image with `width 800`, `height 600` and a key starting `theme-images/<id>/`. Upload `createPngFile(640, 480)` as `second.png`; "Alt text for image 2" is visible. Click "Move image 2 up": the database now has the 640 px image first. Click "Remove image 1": the database has 1 image left, the 800 px one.
- [ ] admin saves an alt text → fill "Alt text for image 1" with `"Aurora cover"`, click "Save alt text for image 1"; reload the page; the field has the value `"Aurora cover"`; the database has `alt "Aurora cover"`
- [ ] a too small image is refused with a message → on the `Small Aurora` theme upload `createPngFile(100, 100)`: the text "Images must be 400 to 6000 pixels wide and high." is visible and the database still has 0 images
- [ ] a file that is not an image is refused → upload `{ name: "x.gif", mimeType: "image/gif", buffer: Buffer.from("not an image") }`: the text "Please upload a JPG, PNG or WebP image up to 3 MB." is visible; 0 images

Break check (≥ 3): remove the `"images.11": { $exists: false }` filter from `pushThemeImage`; remove the key-prefix check in `addThemeImage`;
remove the published-theme check in `removeThemeImage`; remove the `deleteObject` call for the oversized image.

## Do NOT

- Do not import `@aws-sdk/*` anywhere except `src/shared/storage/s3.ts`. Do not set an `ACL`. Never put a URL in the database (D-053).
- Do not add any field or index to the theme model. Do not resize or convert images (D-058).
- Do not call `activityService.log` here (07 §3.3: no activity log entry).
- Services and repositories do not import `next/*`. Feature components and pages: layout classes only (`pnpm check:styles`).
- No `any`, no `@ts-ignore`, no `eslint-disable`. Do not change the existing tests.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-006: storage module and theme images`
