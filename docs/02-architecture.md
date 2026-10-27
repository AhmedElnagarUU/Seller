# 02 — Architecture and coding conventions

This document says **where code goes** and **how code is written**.
Every task follows it. If something here conflicts with a task file, stop and ask in `docs/QUESTIONS.md`.

The two goals behind every rule here:

1. **Keep it simple (KISS).** Code a beginner can read beats clever code.
2. **One way to do each thing.** When there is a rule, there are no exceptions, so you never have to choose.

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
| Unit tests | `vitest` | 5 |
| DB for tests | `mongodb-memory-server` | 11 |
| E2E tests | `@playwright/test` | 1 |
| Lint / format | `eslint` (Next.js config), `prettier`, `prettier-plugin-tailwindcss` | — |

**This is the complete list of allowed packages.** Adding any other package requires a decision in `01-decisions.md` first.
Not allowed, for example: UI kits, form libraries, state managers (Redux, Zustand), `axios`, `lodash`, `moment`, `date-fns`.
Use what the platform gives you (`fetch`, `Intl.NumberFormat`, `Intl.DateTimeFormat`).

---

## 2. Folder structure (feature-based)

The code is split by **feature** (D-084). Everything about one feature — database model, queries, business rules,
form handling, validation, types and UI — lives in **one folder**. Code used by many features lives in `shared/`.

```
/
├─ AGENTS.md, CLAUDE.md
├─ docs/                       planning docs
├─ tasks/                      task files
├─ .env.example                every env variable, with comments, no real values
├─ docker-compose.yml          local MongoDB (replica set) + MinIO (local S3)
├─ next.config.ts
├─ e2e/                        Playwright tests
└─ src/
   ├─ app/                     Next.js routes ONLY (pages, layouts, api route handlers). Very thin.
   ├─ features/
   │  ├─ auth/                 login, register, sessions (Better Auth)
   │  ├─ users/                account settings, admin customer list
   │  ├─ categories/
   │  ├─ themes/
   │  ├─ versions/             theme zips, changelogs
   │  ├─ ownerships/           who can download which theme, admin grants
   │  ├─ orders/               paid orders, admin dashboard numbers
   │  ├─ coupons/
   │  ├─ payments/             PaymentProvider interface, Polar, checkout, webhooks
   │  ├─ downloads/            download links, download logs
   │  └─ emails/               sending emails, email templates, update-email sender
   └─ shared/
      ├─ ui/                   Button, Input, Textarea, Select, Badge, Card, Alert, ... (used by all features)
      ├─ lib/                  small pure helpers: money.ts, dates.ts, semver.ts, slug.ts
      ├─ db/                   connect.ts, ids.ts, transaction.ts
      ├─ storage/              s3.ts (the only place that uses @aws-sdk)
      ├─ config/env.ts         reads + validates ALL environment variables
      ├─ errors.ts             AppError
      ├─ types/                ActionResult and other shared types
      └─ test/                 test helpers only (db.ts for the in-memory MongoDB)
```

### 2.1 Files inside a feature

Example for `themes`. The file name always starts with the **singular** feature name.

```
features/themes/
├─ theme.model.ts            Mongoose schema + model. Shows exactly what is stored in the database.
├─ theme.repository.ts       ALL database queries for this feature. The only file that uses the model.
├─ theme.service.ts          Business rules. Calls the repository. Called by actions, pages and other features.
├─ theme.mapper.ts           Converts database records into DTOs for pages.
├─ theme.actions.ts          Server actions ("use server"). Thin: auth → validate → service → revalidate.
├─ theme.schemas.ts          zod schemas for inputs (used by forms and actions).
├─ theme.types.ts            DTO types and other TypeScript types.
├─ theme.constants.ts        Enum lists and limits (THEME_STATUSES, MAX_THEME_IMAGES, ...).
├─ theme.service.test.ts     Tests (next to the file they test).
└─ components/
   ├─ ThemeCard.tsx
   ├─ ThemeGallery.tsx
   └─ admin/
      └─ ThemeForm.tsx        Admin screens live inside the feature (no separate admin feature).
```

A feature only has the files it needs. For example, `payments` has no model, `categories` has no `mapper` if the
task does not need one. **The task file always lists exactly which files to create.**

Some features have extra files with a clear job. They are listed in the task that creates them, for example:
`auth/auth.ts` (Better Auth instance), `auth/session.ts` (session helpers),
`payments/polar/polar.provider.ts`, `payments/payment.webhook.ts`, `emails/templates/UpdateEmail.tsx`.

### 2.2 The layers

Every request goes through the same layers, always in this order. **No layer is ever skipped** (D-086),
even when a function only passes data through.

```
app/ page.tsx or route.ts         (Next.js)
        ↓
<feature>.actions.ts              (Next.js server actions — only for forms)
        ↓
<feature>.service.ts              (plain TypeScript — business rules)
        ↓
<feature>.repository.ts           (plain TypeScript — database queries)
        ↓
<feature>.model.ts                (Mongoose schema)
```

### 2.3 What each file may import

| File | May import | Must NOT import |
|---|---|---|
| `app/**/page.tsx`, `layout.tsx` | services (to read data), components, `auth/session.ts`, `next/*` | repositories, models, `mongoose` |
| `app/api/**/route.ts` | one handler/service function, `next/*` | repositories, models, `mongoose` |
| `*.actions.ts` | own service, own schemas, `auth/session.ts`, `next/cache`, `next/navigation`, `shared/*` | repositories, models |
| `*.service.ts` | own repository, own mapper, **other features' services**, `shared/*` | **anything from `next/*`**, `auth/session.ts`, other features' repositories or models |
| `*.repository.ts` | own model, `shared/db/*`, `mongoose` types | `next/*`, services, other features' models |
| `*.model.ts` | `mongoose`, own constants | anything else |
| `*.mapper.ts`, `*.schemas.ts`, `*.types.ts`, `*.constants.ts` | `zod`, own constants/types, `shared/lib` | services, repositories, models, `next/*` |
| `components/**` | own and other features' `types`, `constants`, `schemas`, `actions`, `components`; `shared/ui`, `shared/lib` | services, repositories, models |
| `shared/**` | other `shared/*` | anything in `features/` |

The three most important rules:

1. **Services and repositories never import from Next.js** (D-085). They are plain TypeScript, so they can move to
   another backend (e.g. Express) later without changes. Things like `redirect`, `revalidatePath`, `cookies`,
   `headers` are only used in actions, pages and route handlers.
2. **Features talk to each other only through services** (D-087). `orders` may call
   `ownershipService.grantFromOrder(...)`. It may never import `ownership.repository.ts` or `ownership.model.ts`.
3. **Components never fetch data.** The page gets the data from a service and passes it down as props.
   Components only display data and call actions.

Other folder rules:

- `app/` only wires things together: read params, call a service, render components. No business rules in `app/`.
- **Only `features/payments/polar/`** may import `@polar-sh/sdk` (D-032).
- **Only `shared/storage/`** may import `@aws-sdk/*` (D-051).
- **Only `shared/config/env.ts`** may read `process.env`. Everyone else imports `env` from it.
  (Exception: `next.config.ts`, which runs before the app.)
- **No `index.ts` barrel files** (D-088). Always import from the real file.
- Always import with the `@/` alias (`@/features/themes/theme.service`), never `../../`.

### 2.4 Services receive the user as a parameter

Because services cannot use Next.js, they cannot read cookies or the session. The action or page gets the current
user and passes the id in:

```ts
// theme.actions.ts  (Next.js side)
const user = await requireAdmin();
await createTheme(parsed.data, user.id);

// theme.service.ts  (plain TypeScript)
export async function createTheme(input: CreateThemeInput, adminUserId: string): Promise<ThemeAdminDTO> { ... }
```

---

## 3. Coding rules (KISS)

These apply to every file (D-089).

1. **Small functions.** About 40 lines maximum. If longer, split it into well-named helper functions in the same file.
2. **Small files.** About 250 lines maximum. If longer, split by responsibility (the task will say how).
3. **Early return instead of nesting.** Maximum 2 levels of `if`/loop nesting. No nested ternaries (`a ? b : c ? d : e`).
4. **Clear names, no abbreviations.** `ownership`, not `own`. `themeVersion`, not `tv`. Booleans start with
   `is`/`has`/`can` (`isPublished`).
5. **No clever code.** No complex `reduce`, no custom generic types, no "smart" helpers, no metaprogramming.
   A plain `for` loop or `if` is fine.
6. **Rule of three.** Do not create a shared helper or abstraction until the same code is needed in 3 places.
   Repeating 5 lines twice is fine.
7. **Comments explain *why*, not *what*.** Every exported function in a service or repository has a one-line comment
   saying what it does. Do not comment obvious lines.
8. **Exported functions declare their return type.**
9. **No magic numbers or strings.** Limits and enum values live in `<feature>.constants.ts` or `shared/lib`.
10. **`async`/`await` only.** Never `.then()` chains.
11. **One error pattern:** throw `AppError` in services, catch it in actions (section 6).
12. **`"use client"` only on small leaf components** that need state, effects or event handlers.
    Pages and layouts are always Server Components.
13. **Imports always use `@/`.** Named exports only; default exports only where Next.js requires them
    (`page.tsx`, `layout.tsx`, `route.ts` handlers are named `GET`/`POST`).
14. TypeScript strict. No `any`, no `@ts-ignore`, no `eslint-disable`.

---

## 4. Naming

| Thing | Rule | Example |
|---|---|---|
| Feature folders | plural, kebab-case | `features/themes/`, `features/ownerships/` |
| Feature files | `<singular>.<kind>.ts` | `theme.service.ts`, `version.repository.ts` |
| Other folders | kebab-case | `forgot-password/` |
| React component files | PascalCase, one component per file | `ThemeCard.tsx` |
| Tests | next to the file, `.test.ts` | `theme.service.test.ts` |
| Functions | camelCase, start with a verb | `getPublishedThemes`, `createThemeVersion` |
| Server actions | camelCase + `Action` | `createThemeAction` |
| Zod schemas | camelCase + `Schema` | `createThemeSchema` |
| Types from zod | PascalCase + `Input` | `CreateThemeInput` |
| Database record types | PascalCase + `Record` | `ThemeRecord` |
| DTO types | PascalCase + `DTO` | `ThemeCardDTO` |
| Constants | UPPER_SNAKE_CASE | `MAX_THEME_IMAGES` |

---

## 5. How each layer is written

### 5.1 Model (`theme.model.ts`)

The model file is the **readable description of the database**. Every field has a short comment.
The TypeScript type is **generated from the schema** with `InferSchemaType`, so it can never be out of date.

```ts
import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { THEME_STATUSES } from "@/features/themes/theme.constants";

const themeSchema = new Schema(
  {
    // Display name, e.g. "Aurora Blog". 2–80 chars.
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    // Lifecycle: draft → published ⇄ unpublished. See docs/03-data-model.md section 5.
    status: { type: String, required: true, enum: THEME_STATUSES, default: "draft" },
    // Price in US cents. 2900 = $29.00.
    priceCents: { type: Number, required: true, min: 100, max: 100000, validate: Number.isInteger },
    // ... every other field from docs/03-data-model.md, in the same order
  },
  { collection: "themes", timestamps: true },
);

themeSchema.index({ slug: 1 }, { unique: true });
// ... every index from docs/03-data-model.md

export type ThemeRecord = InferSchemaType<typeof themeSchema> & { _id: Types.ObjectId };

// `models.Theme ||` stops hot reload from defining the model twice.
export const ThemeModel = (models.Theme as Model<ThemeRecord>) || model<ThemeRecord>("Theme", themeSchema);
```

Fields, limits and indexes come **only** from `docs/03-data-model.md`, in the same order.

### 5.2 Repository (`theme.repository.ts`)

- Only database queries. No business rules ("can this be published?" belongs in the service).
- Calls `connectDB()` at the start of every function.
- Uses `.lean()` for reads and returns `ThemeRecord` objects (or `null`), never Mongoose documents.
- Every function that writes accepts an optional last parameter `session?: ClientSession` for transactions.

```ts
// Finds a theme by its slug, any status.
export async function findThemeBySlug(slug: string): Promise<ThemeRecord | null> {
  await connectDB();
  return ThemeModel.findOne({ slug }).lean<ThemeRecord>();
}
```

### 5.3 Service (`theme.service.ts`)

- Business rules, checks, and calls to other features' services.
- Throws `AppError` with the exact messages from the specs.
- Returns **DTOs** (made by the mapper) to pages and actions. Never returns a `ThemeRecord` outside the feature.
- No Next.js imports. Receives the user id as a parameter.

### 5.4 Mapper (`theme.mapper.ts`)

Small pure functions that turn a `ThemeRecord` into a DTO: `_id` becomes `id: string`, only the fields the
page needs are kept.

```ts
export function toThemeCardDTO(theme: ThemeRecord): ThemeCardDTO {
  return { id: theme._id.toString(), name: theme.name, slug: theme.slug, priceCents: theme.priceCents, ... };
}
```

### 5.5 Actions (`theme.actions.ts`)

Every server action follows these five steps **in this order**:

```
1. auth check   → const user = await requireAdmin();   (or requireUser / requireVerifiedUser)
2. validate     → const parsed = createThemeSchema.safeParse(...); if (!parsed.success) return { ok: false, ... }
3. call service → inside try/catch (section 6)
4. revalidate   → revalidatePath(...) for every page the spec lists
5. return       → ActionResult, or redirect() when the spec says so (outside try/catch)
```

**The auth check is required in every action, even if the page's layout already checks.**
Layouts do not protect server actions.

### 5.6 Pages (`app/**/page.tsx`)

```tsx
export default async function ThemePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const theme = await getPublishedThemeBySlug(slug);
  if (!theme) notFound();
  return <ThemeDetails theme={theme} />;
}
```

No internal REST API for reading data. Pages call services directly.

### 5.7 Route handlers (`app/api/**/route.ts`)

Only these four exist. Each one calls a single function from a feature and nothing else.

| Route | Calls |
|---|---|
| `api/auth/[...all]` | Better Auth handler from `features/auth/auth.ts` |
| `api/webhooks/polar` | `features/payments/payment.webhook.ts` (`06-payments.md`) |
| `api/downloads/[versionId]` | `features/downloads/download.service.ts` (`07-delivery-updates.md`) |
| `api/cron/send-update-emails` | `features/emails/update-email.sender.ts` (`09-emails.md`), protected by `CRON_SECRET` |

Do not add route handlers for anything else. Forms use server actions.

---

## 6. Standard shapes

### 6.1 `ActionResult` (in `shared/types/action.ts`)

```ts
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```

- `error` is a sentence the user can read.
- `fieldErrors` comes from `z.flattenError(result.error).fieldErrors` when zod validation fails.
- The initial state for `useActionState` is `null`.

### 6.2 `AppError` (in `shared/errors.ts`)

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

- Services throw `AppError` for expected problems. The `message` is shown to the user.
  Every message is listed in the specs; do not invent new ones.
- Server actions catch errors like this:
  ```ts
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    console.error("createThemeAction failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  ```
- Never put `redirect()` or `notFound()` inside `try/catch`.

---

## 7. Database rules

- `connectDB()` (`shared/db/connect.ts`) caches the connection on `globalThis` so hot reload does not open new
  connections. Every repository function calls it first.
- Multi-document writes listed in `03-data-model.md` section 12 run in a transaction, using the helper
  `withTransaction(fn)` from `shared/db/transaction.ts`. The **service** that owns the event starts the transaction
  and passes the `session` to every service and repository call inside it.
- Convert ids from user input with `toObjectId(id: string)` from `shared/db/ids.ts`, which throws
  `AppError("NOT_FOUND", ...)` for invalid ids. Never call `new Types.ObjectId(userInput)` directly.
- Pagination: page size **20** everywhere. Pages are numbered from 1 and passed as `?page=2`.

---

## 8. Auth rules

- The Better Auth instance is in `features/auth/auth.ts`, using the MongoDB adapter with the same connection
  as Mongoose.
- Session helpers are in `features/auth/session.ts`. This file uses Next.js (`headers()`, `redirect()`), so only
  pages, layouts, actions and route handlers may import it — **never services**.

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

## 9. UI rules (Tailwind only)

- Build every screen from the components in `shared/ui/`. If a needed component does not exist, the task that needs
  it will create it. Do not write one-off styled buttons/inputs inside features.
- Colors, fonts and radius are defined once as theme variables in `src/app/globals.css` (Tailwind v4 `@theme`).
  Use those names (`bg-primary`, `text-muted`), never raw hex values in components.
- Mobile first. Every page must work at 360 px width.
- Every form field has a `<label>`. Every image has `alt`. Buttons show a pending state while an action runs.
- Use `next/image` for theme images and `next/link` for internal links.
- Prices are always shown with `formatPrice(cents)` from `shared/lib/money.ts` → `"$29.00"`.
- Dates are always shown with `formatDate(date)` from `shared/lib/dates.ts` → `"Oct 27, 2026"`.

---

## 10. Environment variables

All are read and validated in `shared/config/env.ts` with zod at startup. If one is missing or invalid, the app
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

## 11. Local development

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

## 12. Tests

- **Unit tests (Vitest)** are required for: everything in `shared/lib/`, every `*.schemas.ts`, every mapper,
  and every service function that changes data.
- Service tests use `mongodb-memory-server` (replica set mode, so transactions work).
  The helper `shared/test/db.ts` starts it once and clears all collections between tests.
- Tests must not call real Polar, S3 or Resend. Those modules are replaced with `vi.mock`.
- E2E tests (Playwright) cover only the main flows in `00-product.md` section 7. They are written in later tasks.

---

## 13. Security rules

- Every server action and route handler checks auth itself (section 5.5).
- A customer can only read their own orders, ownerships and downloads. Always filter by the user id from the
  session, never from the request.
- Never trust prices or theme ids from the browser for payments. The server reads the price from the database.
- Webhooks: verify the signature before reading anything (`06-payments.md`).
- Zip files are never public. Download links expire after 5 minutes.
- Markdown is rendered with `react-markdown` without raw HTML. Never use `dangerouslySetInnerHTML`.
- Never log: passwords, tokens, API keys, session cookies, webhook bodies, full email lists.
