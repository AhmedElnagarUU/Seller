# 01 — Decision log

Every decision about the product and the tech is written here with a number.
Agents must follow these decisions. Only the owner can change one.

**Status meanings**

- **LOCKED**: the owner decided. Do not question it.
- **DEFAULT**: the planner chose it and the owner has not objected yet. Treat it as locked
  unless the owner changes it.
- **OPEN**: not decided yet. Nobody may build anything that depends on it.

When a decision changes, do not delete it. Mark it `REPLACED by D-xxx` and add a new one.

---

## Business

| ID | Decision | Status |
|---|---|---|
| D-001 | Single seller (the owner). No marketplace, no other sellers. | LOCKED |
| D-002 | Only paid themes. No free themes. | LOCKED |
| D-003 | One-time purchase per theme. No subscriptions, no all-access plan. | LOCKED |
| D-004 | Buying a theme gives **lifetime updates**: the buyer can download every current and future version. | LOCKED |
| D-005 | Updates are delivered by **email notification + manual download**. No automatic updates in WordPress, no license keys in the MVP. | LOCKED |
| D-006 | One license type: "use on unlimited sites you own or build for clients". The database still stores a `licenseType` field (only value: `"standard"`) so tiers can be added later. | LOCKED |
| D-007 | No shopping cart. One checkout buys exactly one theme. | LOCKED |
| D-008 | Currency: USD only. Prices are stored as integer cents. | LOCKED |
| D-009 | Coupons are included in the MVP (percent or fixed amount, all or selected themes, optional expiry and usage limit). | LOCKED |
| D-010 | Every theme version has a changelog. It is shown on the theme page and used in update emails. | LOCKED |
| D-011 | A refund removes the buyer's access to that theme automatically. | LOCKED |
| D-012 | Admin can grant a theme to a customer manually (no payment). | LOCKED |
| D-013 | English only. Left-to-right only. | LOCKED |
| D-014 | Only a **full** refund removes access. A partial refund (e.g. a goodwill discount after purchase) keeps access. | LOCKED |
| D-015 | A theme version can never be deleted and its zip can never be replaced. A wrong upload is fixed by uploading a new, higher version. A new version number must be higher than the current latest one. | LOCKED |
| D-016 | When a theme is unpublished it disappears from the store, but people who own it can still download it and still get update emails. | LOCKED |
| D-017 | A theme's slug (its URL part) can be changed only while the theme is a draft. After first publish it is fixed. | LOCKED |
| D-018 | After a coupon is created, only its active flag, expiry date and usage limit can change. Code, discount and themes are fixed; make a new coupon instead. | LOCKED |
| D-019 | Changelog entries are structured: each line has a type (`new`, `improved`, `fixed`, `removed`) and a short text. | LOCKED |

## Accounts

| ID | Decision | Status |
|---|---|---|
| D-020 | Auth library: **Better Auth**. | LOCKED |
| D-021 | Login methods: **email + password** and **Google**. No magic link. | LOCKED |
| D-022 | Customers must have an account to buy. No guest checkout. | LOCKED |
| D-023 | Email must be verified before buying. (Google accounts count as verified.) | LOCKED |
| D-024 | Roles: `customer` and `admin` only. Admin accounts are the emails listed in the `ADMIN_EMAILS` environment variable. | LOCKED |

## Payments

| ID | Decision | Status |
|---|---|---|
| D-030 | Payment provider: **Polar**. It may be replaced later. | LOCKED |
| D-031 | **MongoDB is the source of truth** for themes, orders, ownership and coupons. Polar only takes the payment and tells us about it by webhook. | LOCKED |
| D-032 | All Polar code lives behind a `PaymentProvider` interface. No other part of the code imports the Polar SDK directly. This makes replacing Polar a one-folder change. | LOCKED |
| D-033 | Themes and coupons are created only in **our** admin panel. Our server creates or updates the matching Polar product and discount through the Polar API and stores the Polar IDs. Nobody edits products in the Polar dashboard by hand. | LOCKED |
| D-034 | Ownership is granted **only by the webhook** (or by admin grant), never by the checkout success page. | LOCKED |
| D-035 | Webhooks are verified by signature and handled idempotently (the same event processed twice changes nothing). | LOCKED |
| D-036 | We do not use Polar's built-in "benefits" (file downloads, license keys). We deliver files ourselves. | LOCKED |

## Tech stack

| ID | Decision | Status |
|---|---|---|
| D-040 | Framework: **Next.js** (App Router) with TypeScript in strict mode. The exact version is pinned in T-001. | LOCKED |
| D-041 | Database: **MongoDB** with **Mongoose**. | LOCKED |
| D-042 | Styling: **Tailwind CSS only**. No component library (no shadcn, MUI, etc.). We build our own small set of UI components. | LOCKED |
| D-043 | Input validation: **zod**. | LOCKED |
| D-044 | Package manager: **pnpm**. | LOCKED |
| D-045 | Tests: **Vitest** for unit tests. **Playwright** for a few end-to-end tests of the main flows. | LOCKED |
| D-046 | Lint/format: ESLint + Prettier. | LOCKED |
| D-047 | Email sending: **Resend**. Bulk update emails are sent in batches. | LOCKED |
| D-048 | Hosting: the owner's existing **DigitalOcean VPS**. Details (Docker or not, reverse proxy, process manager) are decided later in a deployment doc. | LOCKED (details OPEN) |
| D-049 | Theme `.zip` files are stored in **private** object storage and downloaded through short-lived signed URLs. They are never public and never served from the Next.js `public/` folder. | LOCKED |
| D-050 | Database hosting: **MongoDB Atlas**. | LOCKED |
| D-051 | File storage uses the **standard S3 API** (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`). The provider (Amazon S3, DigitalOcean Spaces, Cloudflare R2…) is chosen **only by environment variables** (endpoint, region, keys, bucket names). No provider-specific code. The actual provider is picked at deployment. | LOCKED |
| D-052 | Two buckets: a **private** bucket for `.zip` files and a **public** bucket for theme images. Public access is set by bucket policy, not per-object ACLs. | LOCKED |
| D-053 | The database stores **object keys** (e.g. `themes/abc/images/x.webp`), never full file URLs. URLs are built at runtime from an env variable, so changing provider or CDN needs no database change. | LOCKED |

## Code structure

| ID | Decision | Status |
|---|---|---|
| D-084 | **Feature-based folders**: `src/features/<feature>/` holds that feature's model, repository, service, mapper, actions, schemas, types, constants and components. Shared code lives in `src/shared/` (UI components in `shared/ui`). `src/app/` only holds thin Next.js routes. | LOCKED |
| D-085 | Forms use **server actions** (not API routes). **Services and repositories never import from Next.js**, so they can move to another backend (e.g. Express) later. | LOCKED |
| D-086 | Layers are always: page/action → service → repository → model. **No layer is ever skipped**, even for simple reads. | LOCKED |
| D-087 | Features use each other **only through services**. Never import another feature's repository or model. | LOCKED |
| D-088 | No `index.ts` barrel files. Import from the real file with the `@/` alias. | LOCKED |
| D-089 | KISS coding rules in `02-architecture.md` section 3 apply to all code. | LOCKED |
| D-090 | Model types are generated from the Mongoose schema with `InferSchemaType`. Never write the same type by hand. | LOCKED |

## Demos

| ID | Decision | Status |
|---|---|---|
| D-060 | Theme demos are real WordPress sites, run **outside this codebase**. Recommended setup: one WordPress Multisite on a separate droplet, one sub-site per theme. | LOCKED |
| D-061 | The store only stores a `demoUrl` per theme and shows it on a preview page (`/themes/[slug]/preview`) with a top bar and the demo in an iframe. | LOCKED |

## Agent workflow

| ID | Decision | Status |
|---|---|---|
| D-080 | Implementing agent: **OpenCode** with **DeepSeek**. It follows `AGENTS.md`. | LOCKED |
| D-081 | The planner (strong model) writes all docs and task files, and implements T-001 to T-003 as reference code. | LOCKED |
| D-082 | One task = one branch = one Pull Request = one GitHub Issue. | LOCKED |
| D-083 | The task file in `/tasks` is the full spec. The GitHub Issue only tracks status and links to the task file. | LOCKED |

---

## OPEN — waiting for the owner

| ID | Question | Planner's recommendation |
|---|---|---|
| O-003 | Store domain name and demo domain name? | Owner does not have one yet. Code must read the site URL from an env variable, never hard-code it. |
