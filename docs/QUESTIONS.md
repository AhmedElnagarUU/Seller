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
- Status: OPEN (planner, deployment doc)
- Answer: Planned fix: the deployment doc adds a one-time setup step that creates all collections and indexes before the first start (also needed for our own models). Harmless meanwhile.
- Doc updated: —

### Q-008: Files that T-004 needs but does not list
- Task: T-004
- Asked by: Claude (implementing agent)
- Question: Fixed in review: (A) the unused `adminUserId` parameter was removed from the services; (B) forms keep what the user typed after an error (`ActionResult` failure has `values`, helpers `submittedValue` and `formKey`; passwords are never echoed); (C) invalid ids in admin URLs give 404 (`parseObjectId` in `shared/db/ids.ts`); (D) `TextField` has `step` and `inputMode`, and `noValidate` was removed. Still open: (1) `ThemeCard` needs "the UI kit image frame" (4:3, `object-cover`), but no such file is listed and `object-cover` is not allowed in features, so I added `src/shared/ui/ImageFrame.tsx`. (2) `e2e/home.spec.ts` expected the old home heading "Theme Store"; the task replaces the home page, so I changed that test to the new heading "Premium WordPress themes". (3) Coverage (D-134) needed tests for the new `shared/lib` helpers, so I added `form-data.test.ts`, `regex.test.ts`, `action-result.test.ts`. (4) The category description has no error message in the spec, so I used "Use up to 300 characters.". (5) The `/admin/themes` table has no cover thumbnail yet (images come with the upload task). (6) "Live demo" links straight to `demoUrl`, because the `/themes/[slug]/preview` page does not exist yet.
- Options I see: A) accept the open points. B) tell me which ones to change.
- Status: ANSWERED
- Answer: Planner accepts all remaining points: ImageFrame joins the UI kit; the home.spec heading change; the extra shared/lib tests; "Use up to 300 characters." for the category description; the admin cover thumbnail and the /preview link come with the images and preview tasks.
- Doc updated: —
