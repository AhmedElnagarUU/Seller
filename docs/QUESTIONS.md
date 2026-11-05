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
- Status: OPEN
- Answer:
- Doc updated:

### Q-006: requireUser() cannot know the current path
- Task: T-003
- Asked by: Claude (implementing agent)
- Question: `02-architecture.md` section 8 says `requireUser()` redirects to `/login?next=<current path>`, but a server component cannot read its own path (no middleware is allowed, and Next.js gives no pathname). I gave the helpers an optional parameter: `requireUser(currentPath = "/")` and `requireVerifiedUser(currentPath = "/")`; pages pass their own path (`requireUser("/account")`).
- Options I see: A) keep the parameter (current). B) allow a small `x-pathname` header set by a proxy file. C) each page checks `getCurrentUser()` and redirects itself.
- Status: OPEN
- Answer:
- Doc updated:
