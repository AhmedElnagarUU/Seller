# T-001: Project setup (skeleton, tooling, tests, CI)

- Depends on: nothing
- Branch: work on the branch you are told to use
- Read first: `AGENTS.md`, `docs/02-architecture.md` (sections 1, 2, 3, 6, 7, 9, 10, 11), `docs/10-testing.md` (sections 2, 3, 7, 9), `docs/07-delivery-updates.md` section 10

## Goal

An empty but **working** Next.js project with every tool, script and shared base file in place, so later tasks only add features.
No features, no models, no UI kit components yet (those come in T-001b / T-002 / T-003).

## Exact package versions (pin exactly, no `^` or `~`)

dependencies:
- `next` 16.4.5
- `react` 19.3.1
- `react-dom` 19.3.1
- `mongoose` 9.12.0
- `zod` 4.3.4
- `clsx` 2.1.1

devDependencies:
- `typescript` 5.9.3
- `@types/node` 22.20.5
- `@types/react` 19.3.0
- `@types/react-dom` (latest 19.x)
- `tailwindcss` 4.6.7
- `@tailwindcss/postcss` 4.3.4
- `eslint` (the version `eslint-config-next` 16.4.5 needs)
- `eslint-config-next` 16.4.5
- `prettier` 3.9.10
- `prettier-plugin-tailwindcss` 0.8.1
- `vitest` 5.1.0
- `@vitest/coverage-v8` 5.1.0
- `mongodb-memory-server` 11.3.0
- `@playwright/test` 1.64.1

Do not add any other package. If a version above cannot be installed, stop and write it in `docs/QUESTIONS.md`.

## Files

Create exactly these:

```
package.json            "packageManager": "pnpm@10.28.0"; "engines": { "node": ">=22" }; scripts below
pnpm-lock.yaml          generated
tsconfig.json           strict: true, noUncheckedIndexedAccess: true, paths { "@/*": ["./src/*"] }
next.config.ts          output: "standalone"; images.remotePatterns built from env.PUBLIC_IMAGES_BASE_URL (protocol, hostname, port, pathname "<path>/**")
postcss.config.mjs      { plugins: { "@tailwindcss/postcss": {} } }
eslint.config.mjs       next core-web-vitals + typescript; rule "@typescript-eslint/no-explicit-any": "error"; rule "no-console": ["error", { allow: ["error", "warn"] }]
.prettierrc             { "plugins": ["prettier-plugin-tailwindcss"], "printWidth": 120 }
.gitignore              node_modules, .next, coverage, .env, .env.local, playwright-report, test-results
.env.example            the env variables listed below, with the local values and a one-line comment each
docker-compose.yml      mongo (single-node replica set "rs0", port 27017, healthcheck that runs rs.initiate if needed) + minio + minio-init exactly as in docs/07-delivery-updates.md section 10
vitest.config.ts        see "Tests" below
playwright.config.ts    testDir "e2e", baseURL http://localhost:3000, webServer "pnpm build && pnpm start", reuseExistingServer locally
e2e/home.spec.ts        opens "/", expects heading "Theme Store"
scripts/check-styles.mjs  see "Style checker" below
.github/workflows/ci.yml  see "CI" below

src/app/layout.tsx      <html lang="en">, imports ./globals.css, metadata title "Theme Store"
src/app/globals.css     @import "tailwindcss"; @import "../styles/tokens.css";
src/app/page.tsx        temporary home: <main className="p-4"><h1>Theme Store</h1></main>
src/styles/tokens.css   the token pattern of docs/02-architecture.md 9.2, with the token list below

src/shared/config/env.ts      zod schema of the env variables below; parse process.env once; export const env; throw a clear Error listing invalid names
src/shared/db/connect.ts      connectDB(): cached on globalThis (02-architecture section 7)
src/shared/db/ids.ts          toObjectId(id: string): Types.ObjectId — throws new AppError("NOT_FOUND", "Not found.") when invalid
src/shared/db/transaction.ts  withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> using mongoose.connection.transaction / session.withTransaction
src/shared/errors.ts          exactly as docs/02-architecture.md 6.2
src/shared/types/action.ts    exactly as docs/02-architecture.md 6.1
src/shared/lib/clock.ts       now(): Date; setTestNow(date: Date | null): void — setTestNow throws if NODE_ENV !== "test"
src/shared/lib/money.ts       formatPrice(amount: number, currency: "usd" | "egp"): string — usd "$29.00" (Intl, en-US, USD), egp "1,465 EGP" (amount is piasters; whole pounds when no fraction else 2 decimals)
src/shared/lib/dates.ts       formatDate(date: Date): string → "Oct 27, 2026" (Intl en-US, timeZone "UTC")
src/shared/test/setup.ts      see "Tests"
src/shared/test/global-setup.ts  starts MongoMemoryReplSet, stores URI in process.env.MONGODB_URI, stops it at the end

src/shared/lib/money.test.ts
src/shared/lib/dates.test.ts
src/shared/lib/clock.test.ts
src/shared/db/transaction.test.ts
src/shared/db/ids.test.ts
```

## Env variables in T-001 (only these; later tasks add the rest)

| Name | Rule (zod) | Local value in .env.example |
|---|---|---|
| `NODE_ENV` | enum development/test/production, default development | — |
| `APP_URL` | url, no trailing slash | `http://localhost:3000` |
| `MONGODB_URI` | string starting with `mongodb` | `mongodb://localhost:27017/themestore?replicaSet=rs0&directConnection=true` |
| `S3_ENDPOINT` | url | `http://localhost:9000` |
| `S3_REGION` | non-empty | `us-east-1` |
| `S3_ACCESS_KEY_ID` | non-empty | `minioadmin` |
| `S3_SECRET_ACCESS_KEY` | non-empty | `minioadmin` |
| `S3_FORCE_PATH_STYLE` | `"true"`/`"false"` → boolean | `true` |
| `S3_PRIVATE_BUCKET` | non-empty | `store-files` |
| `S3_PUBLIC_BUCKET` | non-empty | `store-images` |
| `PUBLIC_IMAGES_BASE_URL` | url, no trailing slash | `http://localhost:9000/store-images` |

Only `src/shared/config/env.ts` reads `process.env` (exception: test setup files and config files at the root).

## Tokens (names in tokens.css)

Colors: `background`, `surface`, `text`, `text-muted`, `border`, `primary`, `primary-foreground`, `accent`, `success`, `warning`, `danger`, `focus`.
Fonts: `--font-sans`, `--font-heading` (both a system font stack).
Radius: `--radius-sm` 4px, `--radius-md` 8px, `--radius-lg` 12px. Shadows: `--shadow-sm`, `--shadow-md`.
Use a neutral slate palette with indigo primary (values from docs/02-architecture.md 9.2 example). Map each to Tailwind with `@theme inline`.

## Scripts (package.json)

```
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "eslint . --max-warnings 0",
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:coverage": "vitest run --coverage",
"check:styles": "node scripts/check-styles.mjs",
"check:focused": "node scripts/check-styles.mjs --focused",
"format": "prettier --write .",
"e2e": "playwright test"
```

## Tests (vitest.config.ts + setup)

- `environment: "node"`, `globalSetup: "src/shared/test/global-setup.ts"`, `setupFiles: ["src/shared/test/setup.ts"]`,
  alias `@` → `src`, `fileParallelism: false`, `testTimeout: 30000`.
- `test.env`: every env variable above with the local values, `NODE_ENV: "test"`.
- `setup.ts`: `beforeAll` connect mongoose to `process.env.MONGODB_URI`; `beforeEach` delete all documents of every collection and `setTestNow(null)`; `afterAll` disconnect. (Fakes are added later by the tasks that create them.)
- Coverage: provider v8, `include` = `src/features/**/*.service.ts`, `src/features/**/*.mapper.ts`, `src/features/**/*.schemas.ts`, `src/shared/lib/**`; exclude `**/*.test.ts`; thresholds lines 80, branches 80.

## Style checker (`scripts/check-styles.mjs`)

Plain Node, no packages. Two modes:

1. Default: scan every `.tsx` file under `src/features` and `src/app`. Find every `className="..."` string literal and every string literal inside `clsx(...)`. Split by spaces. Remove `sm:`/`md:`/`lg:`/`xl:` prefixes. Each class must equal or start with an allowed entry from docs/02-architecture.md 9.4 (exact-match entries: `flex`, `inline-flex`, `grid`, `block`, `inline-block`, `hidden`, `contents`, `grow`, `relative`, `absolute`, `sticky`, `fixed`, `truncate`, `sr-only`; all others are prefixes ending in `-`). Also fail on `className={` followed by a template string (backtick). Print `file:line class` for every problem and exit 1; print `check:styles OK` and exit 0 when clean.
2. `--focused`: scan every `*.test.ts`, `*.test.tsx` under `src` and `*.spec.ts` under `e2e` for `.only(`, `.skip(`, `.todo(`; print and exit 1 if found.

## CI (`.github/workflows/ci.yml`)

On `pull_request` and push to `main`. One job, ubuntu-latest, Node 22, pnpm via `pnpm/action-setup` (version from packageManager), cache pnpm. Steps, in order:
`pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm check:styles` → `pnpm check:focused` → `pnpm test:coverage` → `pnpm build` (with the .env.example values as env) → `docker compose up -d --wait` → `pnpm exec playwright install --with-deps chromium` → `pnpm e2e`.
Coverage thresholds are not enforced while there are no files in the include list (set `thresholds` only, vitest passes with no covered files — if it does not, add `coverage.all: false` and write a note in the PR).

## Required tests

- [ ] formatPrice › formats USD cents → `formatPrice(2900, "usd")` = `"$29.00"`; `formatPrice(100000, "usd")` = `"$1,000.00"`
- [ ] formatPrice › formats EGP piasters as whole pounds → `formatPrice(146500, "egp")` = `"1,465 EGP"`
- [ ] formatDate › formats in UTC → `formatDate(new Date("2026-10-27T23:30:00Z"))` = `"Oct 27, 2026"`
- [ ] now › returns the test time after setTestNow → equals the given date; after `setTestNow(null)` it is within 1 s of `Date.now()`
- [ ] toObjectId › throws NOT_FOUND for an invalid id → `{ code: "NOT_FOUND", message: "Not found." }`
- [ ] toObjectId › returns an ObjectId for a valid id → `.toString()` equals the input
- [ ] withTransaction › rolls back every write when the function throws → define a tiny test-only model inside the test file, insert 1 doc in the transaction then throw; after: 0 docs in the collection
- [ ] withTransaction › commits when the function succeeds → 1 doc
- [ ] e2e home › shows the heading "Theme Store"

Break check: break `formatPrice` EGP rounding, `toObjectId` validity check, and the rollback (run fn without the session); confirm each related test fails; restore.

## Do NOT

- Do not create any feature folder, model, page other than `/`, or UI kit component.
- Do not install any package not listed. Do not use `any`, `@ts-ignore`, `eslint-disable`.
- Do not hard-code secrets or URLs outside `.env.example` and test config.

## Verify (all must pass)

```
pnpm install
pnpm lint
pnpm typecheck
pnpm check:styles
pnpm check:focused
pnpm test
pnpm build
```
(`pnpm e2e` needs Docker for MongoDB/MinIO; run it if Docker works in your environment, otherwise say so.)

Commit message: `T-001: project setup`
