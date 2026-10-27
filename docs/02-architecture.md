# 02 — Architecture and coding conventions

This document says **where code goes** and **how code is written**.
Every task follows it. If something here conflicts with a task file, stop and ask in `docs/QUESTIONS.md`.

---

## 1. Stack and versions

Exact versions are pinned (no `^` or `~`) in `package.json` by task T-001.
The major versions below were current when this plan was written (October 2026).

| Purpose | Package | Major |
|---|---|---|
| Runtime | Node.js | 22 LTS |
| Framework | `next` (App Router) | 16 |
| UI | `react`, `react-dom` | 19 |
| Language | `typescript` | version officially supported by the pinned Next.js; chosen in T-001 |
| Styling | `tailwindcss`, `@tailwindcss/postcss` | 4 |
| Class names helper | `clsx` | 2 |
| Database | `mongoose` | 9 |
| Validation | `zod` | 4 |
| Auth | `better-auth` | 1 |
| Payments | `@polar-sh/sdk` | 1 |
| File storage | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | 3 |
| Email sending | `resend` | 6 |
| Email templates | `@react-email/components` | 1 |
| Markdown display | `react-markdown` | 10 |
| Server-only guard | `server-only` | — |
| Unit tests | `vitest` | 5 |
| DB for tests | `mongodb-memory-server` | 11 |
| E2E tests | `@playwright/test` | 1 |
| Lint / format | `eslint` (Next.js config), `prettier`, `prettier-plugin-tailwindcss` | — |

**This is the complete list of allowed packages.** Adding any other package requires a decision in `01-decisions.md` first.
Not allowed, for example: UI kits, form libraries, state managers (Redux, Zustand), `axios`, `lodash`, `moment`, `date-fns`.
Use what the platform gives you (`fetch`, `Intl.NumberFormat`, `Intl.DateTimeFormat`).

---

## 2. Folder structure

```
/
├─ AGENTS.md, CLAUDE.md
├─ docs/                      planning docs
├─ tasks/                     task files
├─ .env.example               every env variable, with comments, no real values
├─ docker-compose.yml         local MongoDB (replica set) + MinIO (local S3)
├─ next.config.ts
├─ e2e/                       Playwright tests
└─ src/
   ├─ app/                    routes only (pages, layouts, route handlers). Thin. No business logic.
   │  ├─ (store)/             public store pages, with store header + footer
   │  ├─ (auth)/              login, register, password reset, verify email
   │  ├─ (preview)/           /themes/[slug]/preview — full-screen, no store header
   │  ├─ account/             customer area (login required)
   │  ├─ admin/               admin area (admin required)
   │  ├─ checkout/            checkout success page
   │  └─ api/                 route handlers: auth, webhooks, downloads, cron
   ├─ actions/                server actions ("use server"), one file per area
   │  ├─ admin/               e.g. themes.ts, versions.ts, coupons.ts
   │  └─ account/             e.g. settings.ts
   ├─ server/                 server-only code. Every file starts with: import "server-only";
   │  ├─ env.ts               reads + validates ALL environment variables
   │  ├─ db/connect.ts        Mongoose connection (cached)
   │  ├─ models/              one file per model: Theme.ts, ThemeVersion.ts, ...
   │  ├─ services/            business logic, one file per area: themes.ts, orders.ts, ...
   │  ├─ auth/                Better Auth instance + session helpers
   │  ├─ payments/            PaymentProvider interface + Polar implementation
   │  ├─ storage/             S3 client + signed URL helpers
   │  ├─ email/               send function + templates
   │  └─ errors.ts            AppError class
   ├─ components/
   │  ├─ ui/                  generic building blocks: Button, Input, Textarea, Select, Badge, Card, Alert, ...
   │  ├─ store/               store-specific: ThemeCard, ThemeGallery, PriceTag, ...
   │  ├─ account/
   │  └─ admin/
   ├─ schemas/                zod schemas for inputs (shared by forms and server actions)
   ├─ types/                  DTO types (plain data passed from server to pages/components)
   ├─ lib/                    small pure helpers, safe on client and server: money.ts, dates.ts, semver.ts, slug.ts, constants.ts
   └─ test/                   test helpers only (e.g. db.ts for the in-memory MongoDB)
```

### Rules for folders

1. **`src/app`** only wires things together: read params, call a service or action, render components.
   No database calls, no Mongoose imports, no business rules in `app/`.
2. **`src/server`** is the only place that may import `mongoose`, `better-auth` server APIs, `@polar-sh/sdk`,
   `@aws-sdk/*`, `resend`, or read `process.env`.
3. **Only `src/server/payments/polar/`** may import `@polar-sh/sdk` (D-032).
4. **Only `src/server/storage/`** may import `@aws-sdk/*` (D-051).
5. **Only `src/server/env.ts`** may read `process.env`. Everyone else imports `env` from it.
   (Exception: `next.config.ts`, which runs before the app.)
6. **`src/lib`, `src/schemas`, `src/types`** must not import anything from `src/server`. They run in the browser too.
7. Enum value lists (`THEME_STATUSES`, `CHANGE_TYPES`, …) live in `src/lib/constants.ts` so both models and client
   components can use them.

---

## 3. Naming

| Thing | Rule | Example |
|---|---|---|
| Folders | kebab-case | `forgot-password/` |
| React component files | PascalCase, one component per file | `ThemeCard.tsx` |
| Model files | PascalCase, singular | `ThemeVersion.ts` |
| Other `.ts` files | camelCase | `themes.ts`, `connect.ts` |
| Tests | next to the file, `.test.ts` | `semver.test.ts` |
| Functions | camelCase, start with a verb | `getPublishedThemes`, `createThemeVersion` |
| Server actions | camelCase + `Action` | `createThemeAction` |
| Zod schemas | camelCase + `Schema` | `createThemeSchema` |
| Types from zod | PascalCase + `Input` | `CreateThemeInput` |
| DTO types | PascalCase + `DTO` | `ThemeCardDTO` |
| Constants | UPPER_SNAKE_CASE | `MAX_THEME_IMAGES` |

Use **named exports** everywhere. Default exports only where Next.js requires them (`page.tsx`, `layout.tsx`, …).

---

## 4. How a request flows

### 4.1 Reading data (pages)

```
page.tsx (Server Component)
  → calls a service function, e.g. getThemeBySlug(slug)
      → service connects to DB, runs a Mongoose query with .lean(), maps the result to a DTO
  → passes the DTO to components
```

- Pages are **Server Components** by default. Add `"use client"` only to components that need state,
  effects or event handlers, and keep them small.
- **No internal REST API for reading.** Pages call services directly.
- Services **always return DTOs**, never Mongoose documents. A DTO has `id: string` instead of `_id`,
  and contains only the fields the page needs.

### 4.2 Changing data (forms)

```
Form (Client Component, uses React useActionState)
  → server action, e.g. createThemeAction(prevState, formData)
      1. auth check   (requireAdmin() / requireUser())
      2. parse input  (zod schema .safeParse)
      3. call service (createTheme(input))
      4. revalidatePath(...) for pages that show this data
      5. return ActionResult   — or redirect() on success when the spec says so
```

Every server action follows these five steps **in this order**. No exceptions.

**The auth check is required in every action, even if the page's layout already checks.**
Layouts do not protect server actions.

### 4.3 Route handlers (`src/app/api/`)

Only these exist:

| Route | Purpose |
|---|---|
| `api/auth/[...all]` | Better Auth handler |
| `api/webhooks/polar` | Payment webhooks (`06-payments.md`) |
| `api/downloads/[versionId]` | Checks ownership, logs, redirects to a signed URL (`07-delivery-updates.md`) |
| `api/cron/send-update-emails` | Called every 5 minutes by the server's cron, protected by `CRON_SECRET` (`09-emails.md`) |

Do not add route handlers for anything else.

---

## 5. Standard shapes

### 5.1 `ActionResult` (in `src/types/action.ts`)

```ts
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```

- `error` is a sentence the user can read.
- `fieldErrors` comes from `z.flattenError(result.error).fieldErrors` when zod validation fails.
- The initial state for `useActionState` is `null`.

### 5.2 `AppError` (in `src/server/errors.ts`)

```ts
export const APP_ERROR_CODES = ["NOT_FOUND", "FORBIDDEN", "CONFLICT", "INVALID", "RATE_LIMITED"] as const;
export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  constructor(public code: AppErrorCode, message: string) {
    super(message);
    this.name = "AppError";
  }
}
```

- Services throw `AppError` for expected problems. The `message` is shown to the user, so write it for a customer.
  Every message is listed in the specs; do not invent new ones.
- Server actions catch errors like this:
  ```ts
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    console.error("createThemeAction failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  ```
- Never catch the special errors thrown by `redirect()` and `notFound()`. Call them **outside** `try/catch`.

---

## 6. Database rules

- Connect with `connectDB()` from `src/server/db/connect.ts` at the start of every service function.
  It caches the connection on `globalThis` so hot reload does not open new connections.
- Define models like this, so hot reload does not redefine them:
  ```ts
  export const Theme = (models.Theme as Model<ThemeDoc>) || model<ThemeDoc>("Theme", themeSchema);
  ```
- Use `.lean()` for every read that only returns data.
- Multi-document writes listed in `03-data-model.md` section 12 use a transaction:
  ```ts
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => { /* every query gets { session } */ });
  } finally {
    await session.endSession();
  }
  ```
- Convert ids from user input with a helper `toObjectId(id: string)` in `src/server/db/ids.ts`
  that throws `AppError("NOT_FOUND", ...)` for invalid ids. Never call `new Types.ObjectId(userInput)` directly.
- Pagination: page size **20** everywhere. Pages are numbered from 1 and passed as `?page=2`.

---

## 7. Auth rules

- The Better Auth instance is in `src/server/auth/auth.ts`, using the MongoDB adapter with the same
  connection as Mongoose.
- Session helpers in `src/server/auth/session.ts`:

| Helper | Returns | When there is no valid user |
|---|---|---|
| `getCurrentUser()` | `CurrentUser \| null` | returns `null` |
| `requireUser()` | `CurrentUser` | `redirect("/login?next=<current path>")` |
| `requireVerifiedUser()` | `CurrentUser` | not logged in → like `requireUser`; not verified → `redirect("/verify-email")` |
| `requireAdmin()` | `CurrentUser` | `notFound()` — the admin area must look like it does not exist |

  `CurrentUser` = `{ id: string; name: string; email: string; emailVerified: boolean; isAdmin: boolean; updateEmailsEnabled: boolean }`.
- `isAdmin` = the user's email (lowercased) is in `env.ADMIN_EMAILS`.
- No Next.js middleware/proxy for auth. Checks happen in layouts, pages, actions and route handlers.
- The `next` value in login redirects must be a path starting with `/` and not `//`. Otherwise use `/`.

---

## 8. UI rules (Tailwind only)

- Build every screen from the components in `src/components/ui/`. If a needed component does not exist, the task
  that needs it will create it. Do not write one-off styled buttons/inputs inside pages.
- Colors, fonts and radius are defined once as theme variables in `src/app/globals.css` (Tailwind v4 `@theme`).
  Use those names (`bg-primary`, `text-muted`), never raw hex values in components.
- Mobile first. Every page must work at 360 px width.
- Every form field has a `<label>`. Every image has `alt`. Buttons show a pending state while an action runs
  (use `useFormStatus` or the `pending` value of `useActionState`).
- Use `next/image` for theme images and `next/link` for internal links.
- Prices are always shown with `formatPrice(cents)` from `src/lib/money.ts` → `"$29.00"`.
- Dates are always shown with `formatDate(date)` from `src/lib/dates.ts` → `"Oct 27, 2026"`.

---

## 9. Environment variables

All are read and validated in `src/server/env.ts` with zod at startup. If one is missing or invalid, the app
fails to start with a clear message. `.env.example` lists every one of them.

| Name | Example | Notes |
|---|---|---|
| `APP_URL` | `https://example.com` | Public base URL, no trailing slash. Used in emails and redirects. |
| `MONGODB_URI` | `mongodb+srv://...` | |
| `BETTER_AUTH_SECRET` | 32+ random chars | |
| `BETTER_AUTH_URL` | same as `APP_URL` | Required by Better Auth. |
| `GOOGLE_CLIENT_ID` | | |
| `GOOGLE_CLIENT_SECRET` | | |
| `ADMIN_EMAILS` | `owner@example.com,other@example.com` | Comma separated, case-insensitive. |
| `POLAR_ACCESS_TOKEN` | | |
| `POLAR_WEBHOOK_SECRET` | | |
| `POLAR_SERVER` | `sandbox` or `production` | |
| `S3_ENDPOINT` | `https://fra1.digitaloceanspaces.com` | Empty for Amazon S3. |
| `S3_REGION` | `fra1` / `us-east-1` | |
| `S3_ACCESS_KEY_ID` | | |
| `S3_SECRET_ACCESS_KEY` | | |
| `S3_FORCE_PATH_STYLE` | `false` | `true` for MinIO in local development. |
| `S3_PRIVATE_BUCKET` | `store-files` | Theme zips. |
| `S3_PUBLIC_BUCKET` | `store-images` | Theme images. |
| `PUBLIC_IMAGES_BASE_URL` | `https://store-images.fra1.digitaloceanspaces.com` | Image URL = this + `/` + key. Also read by `next.config.ts` for `images.remotePatterns`. |
| `RESEND_API_KEY` | | |
| `EMAIL_FROM` | `Store <hello@example.com>` | |
| `SUPPORT_EMAIL` | `support@example.com` | Shown on Contact page and in emails. |
| `CRON_SECRET` | 32+ random chars | Sent by the server cron as `Authorization: Bearer <secret>`. |

Adding an env variable = update `env.ts`, `.env.example`, and this table in the same PR, and only if the task says so.

---

## 10. Local development

- `docker compose up -d` starts MongoDB as a **single-node replica set** (needed for transactions) and MinIO (a local S3).
- Payments use the **Polar sandbox** (`POLAR_SERVER=sandbox`). How to receive webhooks locally is in `06-payments.md`.
- Commands (defined in T-001):

| Command | Does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint, zero warnings allowed |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm format` | Prettier write |
| `pnpm e2e` | Playwright tests |

**Before every commit:** `pnpm lint && pnpm typecheck && pnpm test` must pass.

---

## 11. Tests

- **Unit tests (Vitest)** are required for: everything in `src/lib/`, every zod schema in `src/schemas/`, and every
  service function that changes data.
- Service tests use `mongodb-memory-server` (replica set mode, so transactions work).
  A shared helper in `src/test/db.ts` starts it once and clears all collections between tests.
- Tests must not call real Polar, S3 or Resend. Those modules are replaced with `vi.mock`.
- E2E tests (Playwright) cover only the main flows in `00-product.md` section 7. They are written in later tasks.

---

## 12. Security rules

- Every server action and route handler checks auth itself (section 4.2).
- A customer can only read their own orders, ownerships and downloads. Always filter by `userId` from the session,
  never from the request.
- Never trust prices or theme ids from the browser for payments. The server reads the price from the database.
- Webhooks: verify the signature before reading anything (`06-payments.md`).
- Zip files are never public. Download links expire after 5 minutes.
- Markdown is rendered with `react-markdown` without raw HTML. Never use `dangerouslySetInnerHTML`.
- Never log: passwords, tokens, API keys, session cookies, webhook bodies, full email lists.
