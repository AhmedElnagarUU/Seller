# Open questions from implementing agents

When a task or doc does not tell you what to do, add an entry here **instead of guessing**.
The owner or planner answers it, updates the relevant doc, then marks it answered.

## Format

```
### Q-<number>: <short title>
- Task: T-XXX
- Asked by: <agent / model name>
- Question: <what is unclear, one or two sentences>
- Options I see: <optional: A) ... B) ...>
- Status: OPEN
- Answer: <filled in by owner/planner>
- Doc updated: <file + section, filled in by owner/planner>
```

## Questions

### Q-001: tailwindcss 4.6.7 does not exist
- Task: T-001
- Asked by: Claude (implementing agent)
- Question: The task pins `tailwindcss` 4.6.7, but the npm registry has no such version (latest is 4.3.4).
- Options I see: A) 4.3.4, same as `@tailwindcss/postcss` (used for now so the build works). B) another version.
- Status: ANSWERED
- Answer: A) 4.3.4. Planner error: the versions of tailwindcss (4.3.4) and zod (4.6.7) were swapped in the task. zod upgraded to 4.6.7.
- Doc updated: tasks/T-001-project-setup.md

### Q-002: Docker image tags for mongo, minio, mc
- Task: T-001
- Asked by: Claude (implementing agent)
- Question: The task says tags are "pinned in T-001" but gives none. I used `mongo:8.0.4` (verified, works). For `minio/minio:RELEASE.2025-04-22T22-12-26Z` and `minio/mc:RELEASE.2025-04-16T18-13-26Z` I could not verify the tags (Docker Hub pull was denied in my sandbox; MinIO may have stopped publishing images there).
- Options I see: A) keep these tags. B) owner names tags or another registry for MinIO.
- Status: OPEN (planner checks on first CI run)
- Answer: Keep mongo:8.0.4 and the MinIO tags for now. GitHub CI will show whether the MinIO images pull; if not, the planner picks another image.
- Doc updated: —

### Q-003: MONGODB_URI in vitest `test.env`
- Task: T-001
- Asked by: Claude (implementing agent)
- Question: The task says `test.env` holds every env variable, but a fixed `MONGODB_URI` there overrides the in-memory URI that `global-setup.ts` sets, so tests cannot connect. I left `MONGODB_URI` out of `test.env`.
- Options I see: A) keep it out (current). B) pass the URI with vitest `provide`/`inject`.
- Status: ANSWERED
- Answer: A) Keep MONGODB_URI out of test.env; global-setup.ts provides it.
- Doc updated: tasks/T-001-project-setup.md (Tests section)

### Q-004: /dev/ui returns 404 in the e2e run (production build)
- Task: T-002
- Asked by: Claude (implementing agent)
- Question: The task says `/dev/ui` must `notFound()` when `env.NODE_ENV === "production"`, and the e2e tests open `/dev/ui`. But `playwright.config.ts` runs `pnpm build && pnpm start`, which is a production build, so `/dev/ui` is 404 and all 3 ui-kit tests fail. They pass only when the whole run is started with `NODE_ENV=test pnpm e2e` (Next then builds and serves with NODE_ENV=test).
- Options I see: A) the e2e command sets `NODE_ENV=test` (in `package.json` script or `playwright.config.ts` `webServer.env`); the page stays as specified. B) guard with a new env variable instead. C) e2e runs against `next dev`.
- Status: ANSWERED
- Answer: Planner error. The page is guarded by a new env flag `ENABLE_DEV_PAGES` (default false; true in .env.example and CI). Implemented by the planner.
- Doc updated: docs/02-architecture.md section 10, tasks/T-002-ui-kit.md

### Q-005: EMAIL_TRANSPORT=console is refused by the production build that e2e uses
- Task: T-003
- Asked by: Claude (implementing agent)
- Question: `env.ts` must refuse `EMAIL_TRANSPORT=console` when `NODE_ENV=production` (D-119), but `playwright.config.ts` runs `pnpm build && pnpm start`, which is `NODE_ENV=production`. So `pnpm e2e` fails at `next build` with "Invalid or missing environment variables: EMAIL_TRANSPORT" (same kind of problem as Q-004). I implemented the rule as specified and ran the e2e locally with `NODE_ENV=test pnpm e2e`.
- Options I see: A) the e2e command sets `NODE_ENV=test` (`package.json` script or `webServer.env`). B) a dedicated flag (like `ENABLE_DEV_PAGES`) that allows `console` in the e2e build. C) e2e runs a real `resend` transport against a local fake (not possible without network).
- Status: ANSWERED
- Answer: Planner error. New env `APP_ENV` (D-092); console emails are refused only when `APP_ENV=production`. Implemented by the planner; plain `pnpm build` / `pnpm e2e` work again.
- Doc updated: 01-decisions D-092, 02-architecture §10, 06-payments, 09-emails

### Q-006: requireUser() cannot know the current path
- Task: T-003
- Asked by: Claude (implementing agent)
- Question: `02-architecture.md` section 8 says `requireUser()` redirects to `/login?next=<current path>`, but a server component cannot read its own path (no middleware is allowed, and Next.js gives no pathname). I gave the helpers an optional parameter: `requireUser(currentPath = "/")` and `requireVerifiedUser(currentPath = "/")`; pages pass their own path (`requireUser("/account")`).
- Options I see: A) keep the parameter (current). B) allow a small `x-pathname` header set by a proxy file. C) each page checks `getCurrentUser()` and redirects itself.
- Status: ANSWERED
- Answer: Accepted: `requireUser(currentPath)` / `requireVerifiedUser(currentPath)` with the page passing its own path. Every later task lists the path.
- Doc updated: docs/02-architecture.md §8

### Q-007: First sign-up on an empty database sends 2 verification emails
- Task: T-003
- Asked by: Claude (implementing agent, reported as an observation)
- Question: On a brand-new database, the first sign-up printed two verification emails (one with an unsaved user id). Likely Better Auth's MongoDB transaction retrying while collections are created inside it. Not seen on a database that already has the collections.
- Status: ANSWERED
- Answer: `ensureDatabase()` creates every collection on server start (D-147), built in T-020.
- Doc updated: docs/11-deployment.md §7

### Q-008: Files that T-004 needs but does not list
- Task: T-004
- Asked by: Claude (implementing agent)
- Question: Fixed in review: (A) the unused `adminUserId` parameter was removed from the services; (B) forms keep what the user typed after an error (`ActionResult` failure has `values`, helpers `submittedValue` and `formKey`; passwords are never echoed); (C) invalid ids in admin URLs give 404 (`parseObjectId` in `shared/db/ids.ts`); (D) `TextField` has `step` and `inputMode`, and `noValidate` was removed. Still open: (1) `ThemeCard` needs "the UI kit image frame" (4:3, `object-cover`), but no such file is listed and `object-cover` is not allowed in features, so I added `src/shared/ui/ImageFrame.tsx`. (2) `e2e/home.spec.ts` expected the old home heading "Theme Store"; the task replaces the home page, so I changed that test to the new heading "Premium WordPress themes". (3) Coverage (D-134) needed tests for the new `shared/lib` helpers, so I added `form-data.test.ts`, `regex.test.ts`, `action-result.test.ts`. (4) The category description has no error message in the spec, so I used "Use up to 300 characters.". (5) The `/admin/themes` table has no cover thumbnail yet (images come with the upload task). (6) "Live demo" links straight to `demoUrl`, because the `/themes/[slug]/preview` page does not exist yet.
- Options I see: A) accept the open points. B) tell me which ones to change.
- Status: ANSWERED
- Answer: Planner accepts all remaining points: ImageFrame joins the UI kit; the home.spec heading change; the extra shared/lib tests; "Use up to 300 characters." for the category description; the admin cover thumbnail and the /preview link come with the images and preview tasks.
- Doc updated: —

### Q-009: `validationFailure` and `failureFrom` cannot be returned from an action with data
- Task: T-006
- Asked by: Claude (implementing agent)
- Question: `createImageUploadUrlAction` must return `ActionResult<PresignedUpload>`, but `validationFailure` and `failureFrom` in `src/shared/lib/action-result.ts` return `ActionResult` (data `undefined`), so TypeScript refuses the `return`. That file is not in the T-006 file list. I added a small local function `asUploadFailure` in `theme-image.actions.ts` that only narrows the type. T-008 (zip upload URL) will hit the same problem.
- Options I see: A) keep the local function. B) change the two helpers to return only the failure part of `ActionResult` (it fits every `ActionResult<T>`) and remove the local function.
- Status: OPEN
- Answer:
- Doc updated:

### Q-010: Theme images do not show on a local machine (Next.js blocks `localhost` image sources)
- Task: T-006
- Asked by: Claude (implementing agent)
- Question: Uploads work and the image is saved, but `next/image` (used by `ImageFrame`) refuses to load it locally. The server logs `upstream image http://localhost:9000/store-images/... hostname resolved to private IP ["127.0.0.1"] ... use images.dangerouslyAllowLocalIP = true`, and the admin and store pages show a broken image. Production is not affected (the R2 public address is not a private IP). T-006 says not to change `next.config.ts`, so I changed nothing. The e2e tests still pass because they check the database and the labels, not the picture.
- Options I see: A) in `next.config.ts` set `images.dangerouslyAllowLocalIP: true` only when `APP_ENV` is `local` or `ci`. B) leave it: images are broken in local development and e2e only.
- Status: OPEN
- Answer:
- Doc updated:

### Q-011: The MinIO images of `docker-compose.yml` could not be pulled (follow-up of Q-002)
- Task: T-006
- Asked by: Claude (implementing agent)
- Question: `docker pull minio/minio:RELEASE.2025-04-22T22-12-26Z` and `minio/mc:RELEASE.2025-04-16T18-13-26Z` both answer "pull access denied ... repository does not exist or may require 'docker login'" in my sandbox (the `mongo:8.0.4` image pulls fine from the same registry). It may be only my sandbox. I ran `e2e/theme-images.spec.ts` against another local S3-compatible server on port 9000 with the same two buckets, and all 4 tests passed. Please run `docker compose up -d` and `pnpm e2e` once on a normal machine or in CI to confirm against real MinIO.
- Options I see: A) the tags pull fine elsewhere: nothing to do. B) they do not: pin other MinIO images in `docker-compose.yml`.
- Status: OPEN
- Answer:
- Doc updated:

### Q-012: `auth.service.test.ts` fails about 1 run in 5 (not caused by T-007)
- Task: T-007
- Asked by: Claude (implementing agent)
- Question: The first test of `src/features/auth/auth.service.test.ts` ("registerUser › creates the user with country and default settings") sometimes fails with `MongoServerError: Unable to write to collection 'themestore-test.user' due to catalog changes; please retry the operation`. I measured it by running that one file many times: 1 of 15 runs fails on the T-004 code (before my tasks), and 5 of 24 on the current code. It looks like a race: Better Auth creates the first user in a transaction while Mongoose is still building the indexes of the `user` collection for `UserModel`. When it happens, `pnpm test` or `pnpm test:coverage` fails and a re-run passes. I did not change any existing test or the test setup (not in my file list).
- Options I see: A) in `src/shared/test/setup.ts`, `await UserModel.init()` in `beforeAll` so the indexes exist before any test runs. B) leave it and re-run when it fails.
- Status: OPEN
- Answer:
- Doc updated:

### Q-013: `ChangesEditor` needs controlled fields, but `SelectField` and `TextField` have no `onChange`
- Task: T-008
- Asked by: Claude (implementing agent)
- Question: `ChangesEditor` (props `changes`, `onChange`) must report every typed character and every chosen type to its parent, but the UI kit's `SelectField` and `TextField` only take `defaultValue` and have no `onChange`. Changing the kit is not in the T-008 file list. I wrapped each row in a plain `<div onChange>` that listens to the change events bubbling up from the two fields, and gave each row a stable `rowId` (so removing a row does not shift the typed values of the others). It works (e2e passes), but it is not the usual React way.
- Options I see: A) keep the wrapper `<div onChange>`. B) add an optional `onChange` prop to `SelectField` and `TextField` in the UI kit and use it in `ChangesEditor`.
- Status: OPEN
- Answer:
- Doc updated:

### Q-014: `putStoredFile` of T-009 cannot run as written (`import()` does not resolve the `@/` paths of `s3.ts`)
- Task: T-009
- Asked by: Claude (implementing agent)
- Question: The helper in the task uses `await import("@/shared/storage/s3")` and `fetch(..., { body: input.body })`. Under Playwright the first fails with `Cannot find module '@/shared/config/env'` (the `import()` loads `s3.ts` natively, so the `@/` paths inside it are not mapped; static imports work). The second does not pass `pnpm typecheck` (`Buffer` is not accepted as a `BodyInit`). I changed the helper (only in `e2e/helpers.ts`): `createRequire(__filename)("@/shared/storage/s3") as typeof import("@/shared/storage/s3")` and `body: new Uint8Array(input.body)`. Behavior is the same (it still loads `.env` first, so `env.ts` sees the variables).
- Options I see: A) keep my version and update the snippet in `tasks/T-009-ownerships-downloads.md`. B) another way to load `s3.ts` after `.env` (for example a `.env` loader in `playwright.config.ts`, then a normal static import).
- Status: OPEN
- Answer:
- Doc updated:

### Q-015: `downloadLogs` TTL index is in 03 §17 and D-148 but not in the T-009 index list
- Task: T-009
- Asked by: Claude (implementing agent)
- Question: T-009 lists two indexes for `downloadLogs` (`{ userId: 1, createdAt: -1 }`, `{ themeId: 1, createdAt: -1 }`), but 03 §17 and D-148 also have `{ createdAt: 1 }` with `expireAfterSeconds: 31536000` (rows deleted after 1 year), and the task says "Model exactly 03 §17". I added the TTL index (constant `DOWNLOAD_LOG_RETENTION_SECONDS` in `download.constants.ts`, same style as the notification and activity models). No required test covers it.
- Options I see: A) keep the TTL index (matches 03 §17). B) remove it and update 03 §17 and D-148.
- Status: OPEN
- Answer:
- Doc updated:

### Q-016: Newer stable `@polar-sh/sdk` 1.x exists than the 1.0.2 named in T-010
- Task: T-010
- Asked by: Claude (implementing agent)
- Question: `npm view @polar-sh/sdk versions` now also lists the stable versions `1.1.0` and `1.3.0` (`latest` is 1.3.0; the planner check of 2026-11-06 saw only up to 1.0.2). The task says to add a question instead of choosing, so I installed exactly `1.0.2` as written. All T-010 code type-checks and its tests pass against 1.0.2 (including real webhook signature checks with `webhooks.validateEvent`).
- Options I see: A) keep 1.0.2. B) upgrade to 1.3.0 in a later task after reading its changelog.
- Status: OPEN
- Answer:
- Doc updated:

### Q-017: The "Theme published." message needs the panel to keep the action states (PublishPanel)
- Task: T-010
- Asked by: Claude (implementing agent)
- Question: The task says each of the three forms in `PublishPanel` runs its own `useActionState` and shows the success `Alert`, and the e2e test expects `Theme published.` to appear. After a successful publish the page is revalidated, `status` becomes `published`, and the Publish form is replaced by the Unpublish form, so a state kept inside the Publish form is lost with it and the message never shows. I kept the three `useActionState` calls in `PublishPanel` (same actions, same messages, same buttons and texts) and let the form that appears after a status change show the success message of the action before it (Unpublish form shows "Theme published.", Publish form shows "Theme unpublished."). The Sync form shows its own result (it disappears after a successful sync, which the e2e test expects). Known small effect: after publish, unpublish, publish again, an old result is replaced by the newest one of the same action only.
- Options I see: A) keep it as it is. B) change the task text so the panel owns the states. C) show the success message from a `?published=1`-style search parameter like `?created=1` (needs a page change that is not in the task).
- Status: OPEN
- Answer:
- Doc updated:

### Q-018: `fake.provider.ts` (simulateFakeRefund) makes an import cycle with the payment provider
- Task: T-012
- Asked by: Claude (implementing agent)
- Question: The task puts `simulateFakeRefund` in `fake/fake.provider.ts`, which must call `processPaymentEvent` and `orderService.getRefundBase`. That creates the import cycle `payment.provider.ts` → `fake.provider.ts` → `payment-event.service.ts` → `order.service.ts` → `theme.service.ts` → `theme-sync.service.ts` → `payment-sync.service.ts` → `payment.provider.ts`. It works (nothing is read while the modules load; only function calls at run time, the build and all tests pass), but a cycle can break if someone later adds a value that is read at load time.
- Options I see: A) keep it as it is. B) move `simulateFakeRefund` to its own file (for example `fake/fake-refund.ts`) so `fake.provider.ts` stays free of service imports.
- Status: OPEN
- Answer:
- Doc updated:

### Q-019: "never throws" and "throw new Error('webhook event row missing')" in `processPaymentEvent`
- Task: T-012
- Asked by: Claude (implementing agent)
- Question: The task says `processPaymentEvent` never throws, and also says to `throw new Error("webhook event row missing")` when the row is gone after a duplicate-key error. I throw that error inside the claim step and catch it at the top of `processPaymentEvent`: it is logged (event id, type and message only) and the outcome is `"temporary_failure"` (HTTP 500, so the provider retries).
- Options I see: A) keep it. B) let the error escape (the route then answers 500 through Next.js).
- Status: OPEN
- Answer:
- Doc updated:

### Q-020: An existing T-012 test checks the whole checkout data object, so the new `wallet` field breaks it
- Task: T-013
- Asked by: Claude (implementing agent)
- Question: T-013 says the T-012 tests of `getCheckoutPageData` "check single properties and keep passing unchanged". One of them does not: `checkout.service.test.ts` › `getCheckoutPageData` › "ready: the 20 % coupon gives quote.finalCents 2320 and finalPriceCents 2320" compares the whole object with `toEqual`, and the object now also has `wallet: null` (the test user has no country). The field is required by the task, so the test cannot pass as it is. I added the single line `wallet: null,` to its expected object and changed nothing else in that test (the assertion is stricter now, not weaker).
- Options I see: A) keep my one-line change. B) change the task text and `wallet` to be left out when it is `null` (not what the task says). C) another change you prefer.
- Status: ANSWERED
- Answer (planner, 2026-11-19): accepted. Adding `wallet: null` to that expected object is the intended change: the field is new in T-013 and the assertion is stricter, not weaker.
- Doc updated:


### Q-021: `e2e/activity.spec.ts` fails when e2e runs twice within a few minutes
- Task: T-015 (found while running e2e)
- Asked by: Claude (planner)
- Question: The test seeds three activity rows dated 1–3 minutes ago and expects to find them on the first page of `/admin/activity` (20 rows). Every e2e run registers several users, and each registration adds a "Customer registered" row with the current time, so a second run within ~3 minutes pushes the seeded rows to page 2 and the test fails. CI runs e2e once on a fresh database, so CI is not affected; it only bites when a developer re-runs e2e quickly.
- Options I see: A) date the seeded rows in the future of the run (e.g. now + 1 hour) so they stay on top. B) open `/admin/activity?customer=<the seeded customer email>` in the "newest first" test as well. C) leave it.
- Status: OPEN
- Answer:
- Doc updated:
