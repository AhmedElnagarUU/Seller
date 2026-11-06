# T-015: Favorites and follows — favorite themes, followed categories

- Depends on: T-014 (and so T-005 … T-013, all merged into `main`)
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2.3, 5, 9; `docs/03-data-model.md` sections 4 (delete rule), 11, 13 (stages);
  `docs/05-pages.md` section 3 (rows `/categories/[slug]`, `/themes/[slug]`) and section 4 (row `/account/favorites`);
  `docs/00-product.md` 3.6; `docs/09-emails.md` 5.4 (how the processor reads `favorites`); `docs/10-testing.md` sections 2, 8 (flow 6).
  Copy the layer pattern of `src/features/categories/` (service, repository, actions) and of `DeleteCategoryButton.tsx`.

## Goal

A customer can **favorite a theme** and **follow a category** (D-110). The rows are listed on `/account/favorites` and
are what the notification processor of T-014 reads (`favorites` with `targetType` + `targetId`, in `_id` order).
This task builds the model, the rules, the buttons, the page, and the clean-up when a category is deleted.

**Not in this task:** sending or creating any notification (T-014 already reads these rows); a ♥ button on theme cards
(05-pages puts it on the theme page only); favorite counts anywhere; any admin screen for favorites.

## Files

```
src/features/favorites/
  favorite.model.ts           03 §11, all fields and both indexes
  favorite.repository.ts
  favorite.service.ts
  favorite.schemas.ts
  favorite.types.ts
  favorite.constants.ts
  favorite.actions.ts
  favorite.service.test.ts
  favorite.schemas.test.ts
  components/FavoriteToggleForm.tsx          ("use client") one small form used by the 4 buttons below
  components/FavoriteButton.tsx              theme page button
  components/FollowCategoryButton.tsx        category page button
  components/FavoriteThemesSection.tsx       /account/favorites, section "Favorite themes"
  components/FollowedCategoriesSection.tsx   /account/favorites, section "Followed categories"

src/features/themes/theme.repository.ts      (change) add findPublishedThemesByIds(ids: string[]): Promise<ThemeRecord[]>
src/features/themes/theme.service.ts         (change) add getPublishedThemeCardById, listPublishedThemeCardsByIds
src/features/themes/theme.service.test.ts    (change) ONLY add the 2 new tests below. Do not touch existing tests.
src/features/themes/components/ThemeDetail.tsx   (change) add the FavoriteButton
src/features/categories/category.service.ts  (change) deleteCategory also deletes the category's favorites (03 §4)
src/features/categories/category.service.test.ts (change) ONLY add the 1 new test below
src/shared/test/factories.ts                 (change) add createFavorite(userId, targetType, targetId)

src/app/themes/[slug]/page.tsx               (change) pass isLoggedIn / isFavorite to ThemeDetail
src/app/categories/[slug]/page.tsx           (change) add FollowCategoryButton
src/app/account/favorites/page.tsx
e2e/favorites.spec.ts
```

**[PLANNER 15-C]** `docs/09-emails.md` 5.4 makes the T-014 processor read `favorites`. Before writing anything, look in
`src/features/favorites/` and `src/shared/test/factories.ts`. If T-014 already created `favorite.model.ts` (and maybe
`favorite.repository.ts`, a function that lists source rows, and a `createFavorite` factory), **keep those files and
those function names exactly**, compare the model with 03 §11, and add only what is missing from the list above.
If nothing exists, create everything. (Planner: replace this paragraph with the real answer when T-014 is final.)

The account pages get their frame (`AccountShell`) from `src/app/account/layout.tsx`, written in T-009. The new page
does **not** wrap itself in `AccountShell`. If that layout file does not exist, stop and write a question in `docs/QUESTIONS.md`.

## Packages

None.

## Constants (`favorite.constants.ts`)

```ts
export const FAVORITE_TARGET_TYPES = ["theme", "category"] as const;
export type FavoriteTargetType = (typeof FAVORITE_TARGET_TYPES)[number];
export const FAVORITE_ID_PATTERN = /^[a-f0-9]{24}$/i;   // an ObjectId written as text
export const FAVORITE_LABELS = {
  favorite: "♥ Favorite",                                  // docs/00 3.1, docs/05 §3
  unfavorite: "[PLANNER 15-B]",
  follow: "Follow category",                               // docs/00 3.1
  unfollow: "[PLANNER 15-B]",
  removeFromList: "Remove",                                // docs/05 §4, button on each favorite theme card
  unfollowFromList: "Unfollow",                            // docs/05 §4, button on each followed category
} as const;
```

**[PLANNER 15-B]** The docs only name the button text of the "not yet" state (`♥ Favorite`, `Follow category`). The
text of the "already done" state, and what a **logged-out** visitor sees when pressing the ♥ button, are not decided.
Recommended: `unfavorite` = `"Remove from favorites"`, `unfollow` = `"Unfollow category"`; a logged-out visitor sees the
same `♥ Favorite` / `Follow category` text as a `ButtonLink` to `/login?next=<encoded page path>`.
The task below is written with the recommended behaviour; confirm or replace.

## Model (`favorite.model.ts`)

Exactly 03 §11: `userId` (ObjectId → `user`, required), `targetType` (enum `FAVORITE_TARGET_TYPES`, required),
`targetId` (ObjectId, required). Collection `favorites`, `{ timestamps: true }`. Indexes exactly:
`{ userId: 1, targetType: 1, targetId: 1 }` unique, and `{ targetType: 1, targetId: 1, _id: 1 }`.
Export `FavoriteModel` and `FavoriteRecord` (`InferSchemaType`, D-090). Field comments as in 02 §5.1.

## Repository (`favorite.repository.ts`)

Every function calls `connectDB()` first (02 §5.2). Ids arrive as strings and are converted with `toObjectId`.

| Function | Does |
|---|---|
| `insertFavoriteIfMissing(userId, targetType, targetId): Promise<void>` | `updateOne({ userId, targetType, targetId }, { $setOnInsert: { userId, targetType, targetId } }, { upsert: true })`. A duplicate-key error (two clicks at the same time) is caught with a local `isDuplicateKeyError` (same code as in `category.repository.ts`) and ignored. |
| `deleteFavorite(userId, targetType, targetId): Promise<void>` | `deleteOne` of that row. A missing row is not an error. |
| `deleteFavoritesByTarget(targetType, targetId): Promise<void>` | `deleteMany({ targetType, targetId })`. |
| `listFavoritesByUser(userId, targetType): Promise<FavoriteRecord[]>` | `.lean()`, sorted `{ _id: -1 }` (most recently added first). |
| `existsFavorite(userId, targetType, targetId): Promise<boolean>` | `exists(...) !== null`. |

## Theme service additions (`theme.service.ts` + `theme.repository.ts`)

| Function | Rules |
|---|---|
| `getPublishedThemeCardById(id: string)` | `ThemeCardDTO` of a **published** theme, else `null` (draft, unpublished, unknown id, invalid id). Uses `findThemeById` and the private `toCards`. |
| `listPublishedThemeCardsByIds(ids: string[])` | Cards of the published themes among `ids`, **in the same order as `ids`**. Unknown, invalid and non-published ids are skipped. Empty `ids` → `[]` without a query. Uses the new `findPublishedThemesByIds` (filter `{ _id: { $in: <valid ids as ObjectId> }, status: "published" }`; ids that are not valid ObjectIds are dropped with `parseObjectId`). |

## Favorite service (`favorite.service.ts`)

Imports `getPublishedThemeCardById`, `listPublishedThemeCardsByIds` from `theme.service` and `getCategoryById` from
`category.service` (D-087: never their repositories). A favorite needs only a logged-in user; the e-mail does not have to be verified.

| Function | Rules / errors |
|---|---|
| `favoriteTheme(userId, themeId)` | theme must be **published** (`getPublishedThemeCardById`), else `AppError("NOT_FOUND", <[PLANNER 15-A theme]>)`. Then `insertFavoriteIfMissing(userId, "theme", themeId)`. Favoriting twice does nothing and does not throw (03 §11). |
| `unfavoriteTheme(userId, themeId)` | `deleteFavorite`. No theme check (a theme that was unpublished later must still be removable). Not favorited → nothing happens, no error. |
| `followCategory(userId, categoryId)` | category must exist (`getCategoryById`), else `AppError("NOT_FOUND", <[PLANNER 15-A category]>)`. Then `insertFavoriteIfMissing(userId, "category", categoryId)`. Twice → nothing, no error. |
| `unfollowCategory(userId, categoryId)` | `deleteFavorite`. No error when not followed. |
| `listFavorites(userId): Promise<FavoritesDTO>` | `themes`: `listPublishedThemeCardsByIds(<theme favorite targetIds in listFavoritesByUser order>)` (rows of non-published themes stay in the database but are not shown). `categories`: for each category favorite, `getCategoryById`; categories that no longer exist are skipped; result `{ id, name, slug }[]` in the same order as the rows (most recently followed first). Only the given user's rows. |
| `isThemeFavorite(userId, themeId): Promise<boolean>` | `existsFavorite`. |
| `isCategoryFollowed(userId, categoryId): Promise<boolean>` | `existsFavorite`. |
| `deleteFavoritesForCategory(categoryId): Promise<void>` | `deleteFavoritesByTarget("category", categoryId)`. Used by `category.service.ts`. |

**[PLANNER 15-A]** The docs say "Only published themes can be favorited" and "Must exist" but give no error text.
Recommended (same text as `docs/06-payments.md` 5.3 and as T-004): theme → `"This theme is not available."`,
category → `"Category not found."`. Replace each `<[PLANNER 15-A …]>` above and in the tests with the decided text.

Types in `favorite.types.ts`: `FollowedCategoryDTO = { id: string; name: string; slug: string }`,
`FavoritesDTO = { themes: ThemeCardDTO[]; categories: FollowedCategoryDTO[] }`.

## Category delete (change in `category.service.ts`)

`deleteCategory(id)` keeps all its existing checks and messages. After `categoryRepository.deleteCategoryById(id)`
succeeds, call `deleteFavoritesForCategory(id)` from `favorite.service.ts` (03 §4: deleting a category also deletes its
`favorites` rows). No transaction is needed: a leftover row would be invisible, because `listFavorites` skips missing
categories. A refused delete (category still has themes) must delete **no** favorites.

## Schemas (`favorite.schemas.ts`)

`favoriteTargetSchema = z.object({ targetId: z.string().trim().regex(FAVORITE_ID_PATTERN, "Not found.") })`.
Type `FavoriteTargetInput`.

## Actions (`favorite.actions.ts`)

`favoriteThemeAction`, `unfavoriteThemeAction`, `followCategoryAction`, `unfollowCategoryAction`.
All have the signature `(previous: ActionResult | null, formData: FormData) => Promise<ActionResult>` and follow 02 §5.5:
1. `const user = await requireUser("/account/favorites")`
2. `favoriteTargetSchema.safeParse({ targetId: readText(formData, "targetId") })` → `validationFailure(parsed.error, {})`
3. service call (`user.id`, `parsed.data.targetId`) in `try/catch` → `failureFrom(error, "<actionName>", {})`
4. `revalidatePath("/account/favorites")`, `revalidatePath("/themes/[slug]", "page")`, `revalidatePath("/categories/[slug]", "page")`
5. `return { ok: true, data: undefined }`

## Components

All forms use `useActionState` (initial `null`) and the UI kit; feature components use layout classes only.

- `FavoriteToggleForm` (`"use client"`): props `action` (one of the 4 server actions), `targetId`, `label`, `pendingText` (always `"Saving…"`),
  `variant?: "primary" | "secondary" | "ghost" | "danger"` (default `"secondary"`), `size?: "sm" | "md"`. Renders
  `<form action={formAction}>` with `<input type="hidden" name="targetId" value={targetId} />`, `FormError` (message from a failed state) and `SubmitButton`.
- `FavoriteButton` props `{ themeId, themeSlug, isFavorite, isLoggedIn }`:
  logged out → `ButtonLink variant="secondary"` to `/login?next=${encodeURIComponent("/themes/" + themeSlug)}` with text `FAVORITE_LABELS.favorite`;
  logged in and not favorite → `FavoriteToggleForm` with `favoriteThemeAction`, label `FAVORITE_LABELS.favorite`;
  logged in and favorite → `FavoriteToggleForm` with `unfavoriteThemeAction`, label `FAVORITE_LABELS.unfavorite`.
- `FollowCategoryButton` props `{ categoryId, categorySlug, isFollowing, isLoggedIn }`: same three cases with `followCategoryAction` / `unfollowCategoryAction`,
  labels `FAVORITE_LABELS.follow` / `FAVORITE_LABELS.unfollow`, login link `/login?next=${encodeURIComponent("/categories/" + categorySlug)}`.
- `FavoriteThemesSection` props `{ themes: ThemeCardDTO[] }`: Heading level 2 "Favorite themes". Empty → Text `You have no favorite themes yet.`
  Otherwise a `Grid columns={3}`; each cell is a `Stack` with `ThemeCard` and a `FavoriteToggleForm` (`unfavoriteThemeAction`, label `FAVORITE_LABELS.removeFromList`, `size="sm"`, `variant="ghost"`).
- `FollowedCategoriesSection` props `{ categories: FollowedCategoryDTO[] }`: Heading level 2 "Followed categories". Empty → Text `You do not follow any category yet.`
  Otherwise a list; each row is an `Inline` with `TextLink` (name → `/categories/<slug>`) and a `FavoriteToggleForm` (`unfollowCategoryAction`, label `FAVORITE_LABELS.unfollowFromList`, `size="sm"`, `variant="ghost"`).

## Pages

- `/account/favorites`: `requireUser("/account/favorites")`, `listFavorites(user.id)`. `metadata` title `Favorites · Theme Store`, `robots: { index: false }`.
  Heading level 1 "Favorites", then `FavoriteThemesSection`, then `FollowedCategoriesSection`, inside a `Stack gap="lg"`. Do not add `PageContainer`/`AccountShell` if `account/layout.tsx` already provides the frame (look at how another account page from T-009 is written and copy it).
- `/themes/[slug]` (change): `const user = await getCurrentUser()`; `isFavorite = user ? await isThemeFavorite(user.id, theme.id) : false`.
  Pass `isLoggedIn={user !== null}` and `isFavorite` to `ThemeDetail`. `ThemeDetail` (as it looks now, after T-008…T-012) gets two new props
  `isLoggedIn: boolean` and `isFavorite: boolean` and renders `<FavoriteButton themeId={theme.id} themeSlug={theme.slug} isFavorite={isFavorite} isLoggedIn={isLoggedIn} />`
  as the **last item** of the `Inline wrap` that holds the Buy/Download and Live demo buttons. Do not change anything else in `ThemeDetail`.
- `/categories/[slug]` (change): same pattern with `isCategoryFollowed(user.id, category.id)`. Put `FollowCategoryButton` directly under the description (or under the heading when there is no description).

## Required tests

`favorite.service.test.ts` (real in-memory MongoDB; ids passed as `x._id.toString()`)
- [ ] favoriteTheme › saves a favorite for a published theme → 1 row with `userId`, `targetType "theme"`, `targetId` equal to the theme id
- [ ] favoriteTheme › does nothing when the theme is already favorited → resolves; still 1 row
- [ ] favoriteTheme › refuses a draft theme → AppError NOT_FOUND with the 15-A theme message; 0 rows
- [ ] favoriteTheme › refuses an unpublished theme → same error; 0 rows
- [ ] favoriteTheme › refuses an unknown or invalid theme id → same error for a new ObjectId and for `"not-an-id"`; 0 rows
- [ ] unfavoriteTheme › removes the row and leaves other users' rows → user A's row gone, user B's row for the same theme still there
- [ ] unfavoriteTheme › does nothing when the theme was not favorited → resolves; row count unchanged
- [ ] unfavoriteTheme › still removes the favorite of a theme that was unpublished later → 0 rows
- [ ] followCategory › saves a follow for an existing category → 1 row with `targetType "category"`
- [ ] followCategory › following twice keeps 1 row
- [ ] followCategory › refuses an unknown category → NOT_FOUND with the 15-A category message; 0 rows
- [ ] unfollowCategory › removes only that category's row → the follow of another category stays
- [ ] listFavorites › returns only the user's published favorite themes, most recently added first → B before A; unpublished theme hidden but its row still in the database; other user's favorites not returned
- [ ] listFavorites › returns followed categories as `{ id, name, slug }`, skipping a category whose document was removed directly from the database
- [ ] isThemeFavorite / isCategoryFollowed › are true only for the user who saved the row → false for another user and for another target
- [ ] favorites index › the database refuses the same favorite twice → `await FavoriteModel.init()` then two `FavoriteModel.create` of the same triple: the second rejects with `code 11000`; 1 row

`favorite.schemas.test.ts`
- [ ] favoriteTargetSchema › accepts a 24-character hex id and refuses `"abc"` with `"Not found."`

`theme.service.test.ts` (add)
- [ ] getPublishedThemeCardById › returns the card for a published theme and `null` for draft, unpublished, unknown and invalid ids
- [ ] listPublishedThemeCardsByIds › keeps the order of the ids given and skips non-published and invalid ids → ids `[c, a, draft, "x"]` return `[c, a]`

`category.service.test.ts` (add)
- [ ] deleteCategory › deletes the favorites of the deleted category only → a category follow row for it is gone; a follow row of another category and a theme favorite row stay; and a refused delete (category with a theme) deletes none

`e2e/favorites.spec.ts` (flow 6 of `docs/10-testing.md` section 8; same style as `e2e/catalog.spec.ts`: `RUN_ID`, models imported with `@/…`, `registerAs`, seeded data removed in `afterAll`; read `CRON_SECRET` from `.env` with `process.loadEnvFile(".env")` like `readMongoUri`)
Seed in `beforeAll`: one category; one **published** theme A in it (like catalog.spec); one **draft** theme B in the same category that can be published: `latestVersion { versionId, version "1.0.0", releasedAt }` plus a real `VersionModel` document for it (all 03 §6 fields: `themeId`, `version "1.0.0"`, `changes [{ type: "new", text: "First release" }]`, `file { key "theme-zips/<themeId>/seed.zip", sizeBytes 1000, sha256 64 × "a", originalName "seed.zip" }`, `releasedAt`, `notifyRequested false`), one image `{ key: "theme-images/<themeId>/seed.jpg", alt: "", width: 800, height: 600 }`, and `provider.productId "fake_prod_seed"`.
- [ ] a customer favorites a theme and follows a category, the admin publishes a new theme in that category, the cron route runs → the customer sees the notification
      Steps: customer (own browser context) registers, opens theme A, clicks the button named `FAVORITE_LABELS.favorite`, waits until a button named `FAVORITE_LABELS.unfavorite` is visible; opens the category page, clicks `FAVORITE_LABELS.follow`, waits for `FAVORITE_LABELS.unfollow`;
      opens `/account/favorites` → sees theme A's name under "Favorite themes" and the category name under "Followed categories".
      Admin (second context) registers as `admin@example.com` (after `removeAdminAccount`, as in catalog.spec), opens `/admin/themes/<theme B id>`, clicks the button "Publish";
      `expect.poll` on `ThemeModel.findById(<B id>)` until `status` is `"published"`.
      Then `request.post("/api/cron/process-notifications", { headers: { Authorization: "Bearer <CRON_SECRET>" } })` → status 200.
      The customer opens `/account/notifications` → the text `New in <category name>: <theme B name>` is visible.
- [ ] a logged-out visitor pressing the favorite button is sent to the login page → on theme A's page click the link `♥ Favorite`; URL is `/login?next=%2Fthemes%2F<slug of A>`

Break check (≥ 3): remove the `published` check in `favoriteTheme`; remove the `deleteFavoritesForCategory` call; remove the duplicate-key `catch` and the `$setOnInsert` upsert (use plain `create`) so the "already favorited" tests fail.

## Do NOT

- Do not add fields or indexes that are not in 03 §11. Do not add `favoritesCount` to themes.
- Do not import `favorite.repository.ts` or `favorite.model.ts` from any other feature (only `favorite.service.ts`). The category and theme services call the favorites **service**.
- Do not put a ♥ button on `ThemeCard`. Do not create notifications or emails here.
- Feature components and pages: layout classes only (`pnpm check:styles`). No `any`, no `@ts-ignore`, no `eslint-disable`.
- Do not change or delete any existing test; only add the listed ones.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-015: favorites and follows`
