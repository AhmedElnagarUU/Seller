# T-020: Production readiness — Docker image, Caddy, deploy and backup scripts, health route, ensureDatabase

- Depends on: T-019 (and so T-005 … T-018, all merged into `main`)
- Read first: `AGENTS.md`; `docs/11-deployment.md` (all of it); `docs/02-architecture.md` sections 2, 10;
  `docs/01-decisions.md` D-140 – D-147; `docs/10-testing.md` sections 2, 4. Route handler style: `src/app/api/downloads/[versionId]/route.ts`.

## Goal

Everything the owner needs to run the store on the VPS of `11-deployment.md`:
1. A production Docker image of the app (Next.js standalone output, already set in `next.config.ts`).
2. `deploy/` with the Compose file, the Caddyfile, `deploy.sh`, `backup.sh` and the crontab lines.
3. `GET /api/health` for Docker, `deploy.sh` and UptimeRobot (D-144).
4. `ensureDatabase()` on server start (D-147, 11 §7), and the same call in the unit-test setup, which fixes the flaky
   first-sign-up test (Q-012: Better Auth created the `user` collection inside a transaction while indexes were built).
5. Staging is hidden from search engines: `robots.ts` disallows everything when `APP_ENV=staging` (11 §1).

**Not in this task**: creating any outside account, the VPS itself, DNS, certificates or env files (owner work, 11 §3 and §10).
No image registry (D-141). No error-tracking service (D-145).

## Packages

None.

## Files

```
Dockerfile
.dockerignore
deploy/docker-compose.yml
deploy/Caddyfile
deploy/deploy.sh                       (executable: git update-index --chmod=+x)
deploy/backup.sh                       (executable)
deploy/crontab.txt
deploy/README.md                       short: what each file is + "see docs/11-deployment.md"

src/app/api/health/route.ts
src/shared/db/ping.ts                  pingDatabase(timeoutMs): Promise<boolean>
src/shared/db/ping.test.ts
src/shared/db/ensure-database.ts       ensureDatabase(): Promise<void>
src/shared/db/ensure-database.test.ts
src/shared/db/models.ts                ALL_MODELS: the list of every Mongoose model of the app (imported from each feature's *.model.ts)
src/instrumentation.ts                 register()
src/shared/test/setup.ts               (change) `await ensureDatabase()` in the existing beforeAll, after mongoose.connect
src/app/robots.ts                      (change) staging rule
src/app/robots.test.ts                 (change) append the staging test below; do not touch the existing tests
```

`src/shared/db/models.ts` is the one allowed place outside a feature that imports every feature's model file (only to
list them for `ensureDatabase`). Nothing else may import it except `ensure-database.ts`.

## `ensureDatabase()` (11 §7)

```ts
// Creates missing collections and builds the indexes of every model, once, when the server starts.
export async function ensureDatabase(): Promise<void>
```
1. `await connectDB()`.
2. For each name of `["user", "session", "account", "verification"]` (Better Auth, 03 §3): when
   `db.listCollections({ name }).toArray()` is empty, `await db.createCollection(name)`.
3. For each model of `ALL_MODELS`, in order: `await Model.createCollection()` then `await Model.syncIndexes()`.
4. `console.log("database ready")` once.
5. Any error: `console.error("ensureDatabase failed", error)` and rethrow.

`ALL_MODELS`: every `*.model.ts` export under `src/features/` (search with `ls src/features/*/*.model.ts`; at the time of
this task that includes users, categories, themes, activity, notifications (2), versions, ownerships, downloads,
coupons, orders, webhook events, wallet payments, settings, favorites, feedback — use what really exists, and list
them alphabetically by file path). A test (below) checks that no model file is missing from the list.

`syncIndexes()` also **drops** indexes that are not in the schema. That is wanted: the schemas are the source of truth (03).

## `instrumentation.ts`

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureDatabase } = await import("@/shared/db/ensure-database");
  await ensureDatabase();
}
```
(A dynamic import, so the edge runtime never loads Mongoose.) The rethrown error stops the server start: the container
then fails its health check and `deploy.sh` stops (11 §7).

## Health route (D-144)

`src/shared/db/ping.ts`: `pingDatabase(timeoutMs)` → `await connectDB()` then `mongoose.connection.db.admin().ping()`,
raced against a `timeoutMs` timer; `true` when the ping answers in time, `false` on any error or timeout (never throws,
never logs connection strings).

`src/app/api/health/route.ts`:
```ts
export const dynamic = "force-dynamic";
export async function GET() {
  const isUp = await pingDatabase(2000);
  return Response.json({ ok: isUp }, { status: isUp ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
```
No auth, no other details in the body.

## `robots.ts` (11 §1)

When `env.APP_ENV === "staging"`: `{ rules: { userAgent: "*", disallow: "/" } }` and no `sitemap`. Otherwise unchanged (T-019).

## Dockerfile (11 §2, D-141)

Multi-stage, `node:22-slim` (pin the exact tag `node:22.21.1-slim` — if `docker pull node:22.21.1-slim` fails, take the newest
`22.x-slim` tag that pulls and write a question), pnpm through Corepack with the version of `package.json` → `packageManager`.

1. `deps`: copy `package.json`, `pnpm-lock.yaml`; `pnpm install --frozen-lockfile`.
2. `build`: copy the source; the env file comes in as a BuildKit secret `--mount=type=secret,id=appenv,target=/app/.env`
   (never `COPY .env`, never `ARG` with secrets); `pnpm build`. The `.env` must not stay in any layer.
3. `runner`: `node:22-slim`, `NODE_ENV=production`, a non-root user `app` (uid 1001), copy `.next/standalone`, `.next/static`
   (to `.next/static`), `public` (when it exists) and `src/content` (the info pages read it at runtime, T-019).
   `EXPOSE 3000`, `CMD ["node", "server.js"]`. The runtime env comes from Compose `env_file`, not from the image.

`.dockerignore`: `node_modules`, `.next`, `.git`, `.env*` (but not `.env.example`), `test-results`, `playwright-report`, `coverage`.

## `deploy/docker-compose.yml` (11 §1, §2)

Services:
- `caddy`: `caddy:2.10.2-alpine` (pin exactly; same fallback rule as node), ports `80:80`, `443:443`, volumes
  `./Caddyfile:/etc/caddy/Caddyfile:ro`, `/srv/themestore/certs:/certs:ro`, a named volume for `/data`. `restart: unless-stopped`.
- `app-production`: `build: { context: .., dockerfile: Dockerfile, secrets: [appenv-production] }`, `env_file: /srv/themestore/production.env`,
  `environment: { PORT: "3000", HOSTNAME: "0.0.0.0" }`, `restart: unless-stopped`, healthcheck
  `node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`
  every 30 s, timeout 5 s, retries 3, start period 30 s. Port **not** published (only Caddy talks to it).
- `app-staging`: the same with `staging.env` and secret `appenv-staging`, `PORT: "3001"`, health URL on 3001.
- top-level `secrets`: `appenv-production: { file: /srv/themestore/production.env }`, `appenv-staging: { file: /srv/themestore/staging.env }`.
- logging for all services: `driver: json-file`, `options: { max-size: "20m", max-file: "5" }` (11 §8).

The domain is **not** written in any file: `deploy.sh` and the Caddyfile read `DOMAIN` from `/srv/themestore/deploy.env`
(one line `DOMAIN=example.com`; Compose passes it to Caddy with `env_file`).

## `deploy/Caddyfile`

Two sites `{$DOMAIN}` → `reverse_proxy app-production:3000` and `staging.{$DOMAIN}` → `reverse_proxy app-staging:3001`,
both `tls /certs/origin.pem /certs/origin.key` (D-146), `encode gzip`. Nothing else.

## `deploy/deploy.sh` (11 §4)

`#!/usr/bin/env bash`, `set -euo pipefail`. Usage `./deploy/deploy.sh <staging|production> <git tag or branch>`; any other
first argument or a missing second one → print the usage line and exit 2. Steps, stopping at the first error:
1. `cd` to the repository root (the script's parent folder).
2. `git fetch --tags origin` and `git checkout --detach <ref>` (for a branch: `origin/<ref>` when it exists, else `<ref>`).
3. `docker compose -f deploy/docker-compose.yml build app-<env>`.
4. `docker compose -f deploy/docker-compose.yml up -d --no-deps app-<env>` (and `up -d caddy` when Caddy is not running).
5. Wait up to 60 s (every 2 s) for `docker compose ... exec -T app-<env> node -e "<the health fetch>"` to succeed;
   print `Deployed <ref> to <env>`; on timeout print `Health check failed` and exit 1.
Never prints env file contents.

## `deploy/backup.sh` (11 §6)

`./deploy/backup.sh production` (only `production` is accepted). Reads `MONGODB_URI` from `/srv/themestore/production.env`
and the backup bucket credentials from `/srv/themestore/backup.env` (`R2_BACKUP_ENDPOINT`, `R2_BACKUP_ACCESS_KEY_ID`,
`R2_BACKUP_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET` — documented in `deploy/README.md`, they are **not** app env variables).
1. `docker run --rm mongo:8.0.4 mongodump --uri="$MONGODB_URI" --archive --gzip > <tmp file>`.
2. `docker run --rm` the `amazon/aws-cli:2.27.49` image (pin exactly; same fallback rule) with the R2 credentials as env
   variables: `s3 cp <tmp file> s3://$R2_BACKUP_BUCKET/mongo/<YYYY-MM-DD>.archive.gz --endpoint-url $R2_BACKUP_ENDPOINT`.
3. Delete the tmp file (also on error: `trap`). Print `Backup done <YYYY-MM-DD>`. Never print the URI or keys.

## `deploy/crontab.txt`

Exactly the three lines of 11 §5, with `<domain>`, `<production CRON_SECRET>` and `<staging CRON_SECRET>` left as
placeholders and a comment line above saying the owner replaces them and installs them with `crontab -e`.

## Required tests

`ensure-database.test.ts` (real in-memory MongoDB)
- [ ] ensureDatabase › creates the Better Auth collections and every model collection on an empty database → drop the database first; after the call `listCollections` has `user`, `session`, `account`, `verification` and the collection of every model in `ALL_MODELS`
- [ ] ensureDatabase › builds the indexes of the models → after the call, `ThemeModel.collection.indexes()` has the unique `{ slug: 1 }` index and `ActivityLogModel` has the TTL index on `createdAt`
- [ ] ensureDatabase › can run twice → a second call resolves and changes nothing
- [ ] ALL_MODELS › lists every model file → the number of files matching `src/features/*/*.model.ts` (read with `node:fs`) equals `ALL_MODELS.length`

`ping.test.ts`
- [ ] pingDatabase › is true when the database answers
- [ ] pingDatabase › is false after a timeout → `pingDatabase(0)` is `false` (the timer wins) and does not throw

`robots.test.ts` (append)
- [ ] robots › disallows everything on staging and has no sitemap → with `env.APP_ENV` set to `"staging"` for that test (use `vi.spyOn` on the `env` object's getter if needed, or the pattern the existing env tests use), `rules` is `{ userAgent: "*", disallow: "/" }` and `sitemap` is `undefined`

Script and image checks (in `Verify`, not unit tests).

Break check (≥ 3): remove `"session"` from the Better Auth list; remove `syncIndexes()`; make `pingDatabase` return `true` in the `catch`; remove the staging rule from `robots.ts`.

## Do NOT

- Never copy an env file into an image layer, never put a secret, domain or IP in a committed file.
- Do not publish the app ports; only Caddy listens on 80/443.
- Do not change the app's env schema (`env.ts`): the deploy-only variables live in `deploy.env` and `backup.env`.
- Do not add a package. No `any`, no `@ts-ignore`, no `eslint-disable`. Do not change existing tests.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
bash -n deploy/deploy.sh && bash -n deploy/backup.sh && ./deploy/deploy.sh 2>&1 | grep -q Usage
docker build --secret id=appenv,src=.env -t themestore-check . && docker run --rm themestore-check sh -c 'test ! -f /app/.env && test ! -f .env'
DOMAIN=example.com docker compose -f deploy/docker-compose.yml config --quiet
```
(The last line needs the two env-file paths of the Compose file to exist; create empty files there **only on the machine
that runs the check**, never in the repo.) Then run the built image once with the local `.env` and Mongo:
`docker run --rm -d --name tc --network host --env-file .env themestore-check`, wait, `curl -fsS http://localhost:3000/api/health`
must print `{"ok":true}`; `docker stop tc`.

Commit: `T-020: production readiness`
