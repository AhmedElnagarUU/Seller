# T-004: Categories and themes — the reference feature (database → service → admin pages → store pages)

- Depends on: T-001, T-002, T-003
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2–7, 9; `docs/03-data-model.md` sections 1, 4, 5;
  `docs/05-pages.md` sections 1, 2, 3 (`/`, `/themes`, `/categories/[slug]`, `/themes/[slug]`) and 5 (themes, categories rows, `ThemeForm`);
  `docs/10-testing.md`.

## Goal

The **example every later task copies**: two complete features with the exact layer pattern, validation,
error handling, tests, admin screens and store pages. Write it as clean and boring as possible.

**Not in this task** (later tasks add them to these same files/pages): publishing/unpublishing, Polar sync, images
upload (07 §3), versions, ownership/Buy/Download buttons, favorites, follow buttons, sitemap/robots, the publish
checklist. Where 05-pages shows those on a page, leave them out — do not add placeholders.

## Files

```
src/shared/lib/form-data.ts            readText(formData, key): string; readCheckbox(formData, key): boolean; readLines(formData, key): string[] (split \n, trim, drop empty)
src/shared/lib/action-result.ts        validationFailure(zodError): ActionResult (move from auth.actions.ts); failureFrom(error, actionName): ActionResult (AppError → message; else console.error + "Something went wrong. Please try again.")
src/shared/lib/regex.ts                escapeRegex(text): string
src/features/auth/auth.actions.ts      (change) import the two helpers above instead of local copies; behaviour unchanged
src/shared/test/factories.ts           createUser(overrides?), createAdmin() (email "admin@example.com", matches test ADMIN_EMAILS), createCategory(overrides?), createTheme(overrides?) — valid defaults; createTheme defaults to status "draft", creates a category when none is given; status "published" sets publishedAt = now()

src/shared/ui/Pagination.tsx           05 §1.5
src/shared/ui/Table.tsx                Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell (no className props)
src/shared/ui/MarkdownText.tsx         react-markdown wrapper (package react-markdown — see Packages); styles headings, lists, links, code inside the kit
src/shared/layout/AdminShell.tsx       05 §5 menu (links for pages that do not exist yet are still listed)

src/features/categories/
  category.model.ts / category.repository.ts / category.service.ts / category.mapper.ts / category.schemas.ts
  category.types.ts / category.constants.ts / category.actions.ts / category.service.test.ts / category.schemas.test.ts
  components/admin/CategoryForm.tsx, components/admin/CategoryTable.tsx, components/admin/DeleteCategoryButton.tsx

src/features/themes/
  theme.model.ts / theme.repository.ts / theme.service.ts / theme.mapper.ts / theme.schemas.ts
  theme.types.ts / theme.constants.ts / theme.actions.ts / theme.service.test.ts / theme.schemas.test.ts / theme.mapper.test.ts
  components/ThemeCard.tsx, ThemeGrid.tsx, ThemeImagePlaceholder.tsx, ThemeFilters.tsx, ThemeGallery.tsx ("use client"), ThemeDetail.tsx
  components/admin/ThemeForm.tsx, components/admin/ThemeTable.tsx

src/app/page.tsx                                   (replace) home, 05 §3
src/app/themes/page.tsx
src/app/themes/[slug]/page.tsx                     with generateMetadata
src/app/categories/[slug]/page.tsx
src/app/not-found.tsx, src/app/error.tsx           05 §1.7, §1.8
src/app/admin/layout.tsx                           requireAdmin() + AdminShell
src/app/admin/page.tsx                             temporary: Heading "Dashboard", Text "Coming soon." (dashboard is a later task)
src/app/admin/categories/page.tsx, new/page.tsx, [id]/page.tsx
src/app/admin/themes/page.tsx, new/page.tsx, [id]/page.tsx
e2e/catalog.spec.ts
```

## Packages

`react-markdown` 10.x — run `npm view react-markdown@10 version`, pin the newest 10.x exactly. Nothing else.

## Models

Exactly 03 §4 (categories) and 03 §5 (themes, all fields and indexes, sub-documents `ThemeImage`, `LatestVersion`
with `{ _id: false }`). Enums in constants files (03 §1.7): `THEME_STATUSES`. Limits as constants used by both
zod and Mongoose (03 §1.11), e.g. `THEME_NAME_MAX = 80`. Types via `InferSchemaType` (D-090): `CategoryRecord`, `ThemeRecord`.

## Category service (`category.service.ts`)

| Function | Rules / errors |
|---|---|
| `createCategory(input, adminUserId)` | name unique case-insensitive (repository `existsByNameInsensitive`, exclude own id on update) → CONFLICT `"A category with this name already exists."`; slug duplicate (E11000) → CONFLICT `"This slug is already used."` |
| `updateCategory(id, input, adminUserId)` | not found → NOT_FOUND `"Category not found."`; same uniqueness rules |
| `deleteCategory(id, adminUserId)` | not found → NOT_FOUND; any theme with this `categoryId` (themes service `countThemesInCategory`) → CONFLICT `"This category still has themes. Move them to another category first."` |
| `listCategoriesForAdmin()` | sorted `sortOrder` asc, then name; includes theme count (all statuses) |
| `listCategoriesWithPublishedCounts()` | for home and filter: `{ name, slug, themeCount }` with **published** counts; sorted like above; includes categories with 0 |
| `getCategoryBySlug(slug)` | `{ id, name, slug, description }` or `null` |
| `getCategoryById(id)` | for admin edit; `null` when missing |

Schema `categoryInputSchema`: name 2–40 (`"Use 2 to 40 characters."`), slug `slug` format (`"Use lowercase letters, numbers and dashes."`),
description optional max 300 (empty string → `null`), sortOrder integer −1000–1000 (`"Enter a whole number."`).

The features must not import each other's repositories (D-087): category.service calls `countThemesInCategory`
from theme.service; theme.service calls `getCategoryById` from category.service.

## Theme service (`theme.service.ts`)

| Function | Rules / errors |
|---|---|
| `createTheme(input, adminUserId)` | category must exist → INVALID `"Choose a category."`; slug duplicate → CONFLICT `"This slug is already used."`; creates `status: "draft"`, `images: []`, `latestVersion: null`, stats 0, provider nulls. Returns `{ id }`. |
| `updateTheme(id, input, adminUserId)` | not found → NOT_FOUND `"Theme not found."`; slug changed after `publishedAt` is set → CONFLICT `"The slug cannot change after the theme was published."` (D-017); category must exist; slug duplicate → CONFLICT. Does not touch status, images, versions, stats, provider. |
| `getThemeForAdmin(id)` | `ThemeAdminDTO` (all editable fields + status, publishedAt) or `null` |
| `listThemesForAdmin({ status, q, page })` | `status` optional; `q` escaped, contains on name; newest `createdAt` first; 20 per page |
| `listPublishedThemes({ q, categorySlug, sort, page })` | 05 §3 search rules; only `status: "published"`; returns `{ items: ThemeCardDTO[], page, totalPages, total }` |
| `getPublishedThemeBySlug(slug)` | `ThemeDetailDTO` or `null` (draft/unpublished → `null`) |
| `getHomePageData()` | 05 §3 `/` row |
| `countThemesInCategory(categoryId)` | all statuses |

Schema `themeInputSchema` (03 §5 limits; one message per field):
name 2–80 `"Use 2 to 80 characters."`; slug `slug`; tagline 10–160 `"Use 10 to 160 characters."`;
description 50–20 000 `"Write at least 50 characters."` / max `"The description is too long."`;
features 0–30 lines each 2–120 `"Each feature needs 2 to 120 characters (max 30 features)."`;
categoryId non-empty `"Choose a category."`;
price: the form sends dollars as text → `z.coerce.number()` 1–1000 with max 2 decimals `"Enter a price between $1.00 and $1,000.00."` → transformed to `priceCents = Math.round(value * 100)`;
demoUrl optional `httpsUrl` (empty → `null`) `"Enter a full https:// address."`;
wordpressMin, phpMin, testedUpTo `wpVersion` `"Use a version like 6.4."`; featured boolean.

## Mapper (`theme.mapper.ts`)

`toThemeCardDTO(theme, categoryName)`, `toThemeDetailDTO(theme, category)`, `toThemeAdminDTO(theme)`.
Image URLs via `publicImageUrl(key)` — create `src/shared/storage/public-url.ts` exactly as 07 §2.3 in this task.
`coverImage` = first image or `null`. `latestVersion` = `theme.latestVersion?.version ?? null`.

## Actions

`createCategoryAction`, `updateCategoryAction`, `deleteCategoryAction`, `createThemeAction`, `updateThemeAction`.
Pattern (02 §5.5): `requireAdmin()` → zod → service in try/catch → revalidate → result/redirect.
- create category/theme → `redirect("/admin/categories")` / `redirect("/admin/themes/<id>?created=1")`; the edit page shows Alert success "Draft created." when `created=1`.
- update → `{ ok: true, data: undefined, message: "Saved." }` and the form shows it as Alert success.
- delete category → `redirect("/admin/categories")`.
- Revalidate after theme/category changes: `/`, `/themes`, `/admin/themes`, `/admin/categories`, and the theme's / category's store path.

## Pages

As 05-pages, limited by "Not in this task" above. `/themes/[slug]`: gallery, name, tagline, price, category link,
"Version <x> · Updated <date>" only when `latestVersion`, requirements, ButtonLink "Buy now" → `/checkout/<slug>`,
"Live demo" when `demoUrl`, Description (MarkdownText), Features. No changelog, no favorite yet.

## Required tests

`category.service.test.ts`
- [ ] createCategory › saves a valid category → DB row with name, slug, description `null`, sortOrder 0
- [ ] createCategory › refuses a name that differs only in case → CONFLICT `"A category with this name already exists."`; 1 category
- [ ] createCategory › refuses a used slug → CONFLICT `"This slug is already used."`
- [ ] updateCategory › allows keeping its own name → saved
- [ ] deleteCategory › refuses a category that has a draft theme → CONFLICT message; category still in DB
- [ ] deleteCategory › deletes an empty category → 0 categories
- [ ] listCategoriesWithPublishedCounts › counts only published themes and keeps empty categories

`theme.service.test.ts`
- [ ] createTheme › saves a draft with price in cents → `priceCents 2900`, `status "draft"`, `images []`, `latestVersion null`, stats 0
- [ ] createTheme › refuses an unknown category → INVALID `"Choose a category."`; 0 themes
- [ ] updateTheme › refuses a slug change after first publish → CONFLICT D-017 message; slug unchanged
- [ ] updateTheme › allows a slug change on a never-published draft
- [ ] updateTheme › does not change status, stats or images
- [ ] listPublishedThemes › returns only published themes
- [ ] listPublishedThemes › searches name and tagline case-insensitively and treats regex characters as text (`"c++"` finds "C++ Docs", does not throw)
- [ ] listPublishedThemes › filters by category slug and ignores an unknown slug
- [ ] listPublishedThemes › sorts by price ascending and by best selling
- [ ] listPublishedThemes › paginates 20 per page → 25 themes: page 1 has 20, page 2 has 5, totalPages 2
- [ ] getPublishedThemeBySlug › returns null for draft and unpublished themes
- [ ] getHomePageData › returns at most 6 featured, best sellers and newest

`theme.schemas.test.ts` / `category.schemas.test.ts` / `theme.mapper.test.ts`
- [ ] themeInputSchema › converts "29.99" to 2999 cents and refuses "0.5" and "12.345"
- [ ] themeInputSchema › turns empty demo URL into null and refuses http://
- [ ] themeInputSchema › splits features by line and drops empty lines (through `readLines` in the action test of the schema input)
- [ ] categoryInputSchema › refuses "Blog Themes" as slug
- [ ] toThemeCardDTO › builds the cover URL from PUBLIC_IMAGES_BASE_URL and the first image key

`e2e/catalog.spec.ts` (seed directly in DB in the test: admin user verified, 1 category, 1 published theme)
- [ ] admin creates a category and a draft theme → the draft is not visible on `/themes`
- [ ] visitor searches `/themes?q=<part of name>` → sees the published theme card → opens it → sees name, price and "Buy now"
- [ ] a non-admin opening `/admin` gets "Page not found"

Break check (≥ 3): remove `escapeRegex`; remove the published filter; remove the D-017 check.

## Do NOT

- Do not add any field or index not in 03. Do not add publishing logic or Polar code.
- Pages and feature components: layout classes only (`pnpm check:styles`).
- No `any`, no `@ts-ignore`, no `eslint-disable`.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-004: categories and themes`
