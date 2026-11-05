# 05 — Pages (store, account, admin)

Every page of the site: URL, who can open it, where its data comes from, what it shows, and its actions.
This doc replaces the planned `08-admin.md` (admin pages are in section 5).
Payment pages are in `06-payments.md`, upload screens in `07-delivery-updates.md`, texts of emails in `09-emails.md`.

---

## 1. Rules for every page

1. **Pages are thin** (02 §5.6): one guard call, one or two service calls, then components. No business rules in pages.
2. **Guards:** `requireUser("<this path>")`, `requireVerifiedUser("<this path>")` or `requireAdmin()` (02 §8).
   The path passed is the page's own URL **without** query string.
3. **Titles:** every page exports `metadata` (or `generateMetadata`) with `title: "<Page title> · Theme Store"`.
   The home page title is `"Theme Store — Premium WordPress themes"`. Admin and account pages add `robots: { index: false }`.
4. **Query params** are parsed with a zod schema in the page (`searchParams` is a Promise in Next 16: `await` it).
   Invalid values fall back to the default, never an error page.
5. **Pagination:** 20 per page (02 §7). Shared component `shared/ui/Pagination.tsx` (added in T-004): props
   `page`, `totalPages`, `buildHref(page)`. Shows "Previous", "Page X of Y", "Next". Hidden when `totalPages <= 1`.
   A page number above `totalPages` shows the empty state.
6. **Empty states:** every list has one. The texts are in the tables below.
7. **Not found:** `app/not-found.tsx` shows Heading "Page not found", Text "The page you are looking for does not exist.",
   ButtonLink "Browse themes" → `/themes`. Unpublished and draft themes are **not found** for everyone on store pages.
8. **Errors:** `app/error.tsx` (client) shows "Something went wrong." + Button "Try again" (calls `reset()`).
9. **Money and dates:** always `formatPrice` and `formatDate` (02 §9.8).
10. **Images:** `next/image` with `sizes`; the URL comes from the DTO (`07` §2.3). Cover = first image. A theme
    without images shows the `ThemeImagePlaceholder` component (a Card with the theme name).
11. Shells: store pages use the root layout. Account pages use `shared/layout/AccountShell.tsx`, admin pages use
    `shared/layout/AdminShell.tsx` (section 4 and 5 list their menus). Both are added by the first task that needs them.

---

## 2. Theme DTOs used by store pages (`theme.types.ts`)

```ts
type ThemeCardDTO = {
  id: string; slug: string; name: string; tagline: string; priceCents: number;
  coverImage: { url: string; alt: string; width: number; height: number } | null;
  categoryName: string; latestVersion: string | null;
};

type ThemeDetailDTO = ThemeCardDTO & {
  description: string;           // markdown
  features: string[];
  images: { url: string; alt: string; width: number; height: number }[];
  demoUrl: string | null;
  requirements: { wordpressMin: string; phpMin: string; testedUpTo: string };
  category: { name: string; slug: string };
  latestVersionReleasedAt: Date | null;
};
```

`ThemeCard` component: cover image (4:3, `object-cover` inside the UI kit image frame), name, tagline (2 lines max),
category name, price. The whole card is a link to `/themes/<slug>`.

---

## 3. Store pages (public)

| URL | Data (service) | Content | Empty state |
|---|---|---|---|
| `/` | `getHomePageData()` → `{ featured: ThemeCardDTO[] (max 6, newest first), bestSellers (max 6, salesCount desc), newest (max 6), categories: { name, slug, themeCount }[] }` | Hero: Heading "Premium WordPress themes", Text "Pay once, get every update for life.", ButtonLink "Browse themes" → `/themes`. Sections in this order, each hidden when empty: "Featured", "Best sellers", "New themes" (each a Grid of ThemeCards + TextLink "See all" → `/themes`, `/themes?sort=best`, `/themes?sort=newest`), "Categories" (links to `/categories/<slug>` with the count). | No published themes at all: Text "New themes are coming soon." |
| `/themes?q=&category=&sort=&page=` | `listPublishedThemes({ q, categorySlug, sort, page })` → `{ items: ThemeCardDTO[], page, totalPages, total }` and `listCategoriesForFilter()` | Heading "Themes". Filter form (GET, no JS needed): TextField "Search" (`q`, max 80 chars), SelectField "Category" (first option "All categories"), SelectField "Sort" (`newest` "Newest", `best` "Best selling", `price-asc` "Price: low to high", `price-desc` "Price: high to low"; default `newest`), Button "Apply". Text "<total> themes". Grid of ThemeCards, Pagination keeps the other params. | "No themes match your search." + TextLink "Clear filters" → `/themes` |
| `/categories/[slug]` | `getCategoryPage(slug, page)` → category `{ name, slug, description }` + themes page; unknown slug → `notFound()` | Heading = category name, description (muted), `FollowCategoryButton` (task that builds favorites), Grid + Pagination. | "No themes in this category yet." |
| `/themes/[slug]` | `getPublishedThemeBySlug(slug)` → `ThemeDetailDTO` or `notFound()`; `listVersionsForTheme(themeId)`; for a logged-in user: `hasActiveOwnership`, `isFavorite` | Left: gallery (cover large + thumbnails, clicking a thumbnail shows it; client component `ThemeGallery`). Right: name (h1), tagline, price, category link, "Version <x> · Updated <date>", requirements list ("WordPress <min>+", "PHP <min>+", "Tested up to WordPress <x>"). Buttons: owner → ButtonLink "Download" → `/account/themes`; otherwise ButtonLink "Buy now" → `/checkout/<slug>`; ButtonLink secondary "Live demo" → `/themes/<slug>/preview` (only when `demoUrl`); `FavoriteButton`. Below: sections "Description" (react-markdown, no raw HTML), "Features" (list, hidden when empty), "Changelog" (each version: "<version> — <date>" + changes as `Badge` type + text). | — |
| `/themes/[slug]/preview` | `getPublishedThemeBySlug(slug)`; no `demoUrl` → `notFound()` | Full-height page **without** store header/footer (own layout in `app/themes/[slug]/preview/layout.tsx`). Top bar: TextLink "← <name>" → theme page, price, device switch (Desktop 100% / Tablet 768px / Mobile 375px width; client state), ButtonLink "Buy now". Below: `<iframe src={demoUrl} title="<name> live demo">` filling the rest. | — |
| `/about`, `/terms`, `/privacy`, `/refund-policy`, `/license` | Markdown file `src/content/<page>.md` read with `fs` at build time | Heading + react-markdown. The owner writes the texts; the task creates each file with a short placeholder paragraph and the heading. | — |
| `/contact` | `env.SUPPORT_EMAIL` | Heading "Contact", Text "Questions before or after buying? Email us at <SUPPORT_EMAIL> and we usually reply within 1–2 business days.", `mailto:` link. Logged-in customers also see TextLink "Send feedback" → `/account/feedback`. | — |

**Search rules (D-115):** `q` is trimmed; empty = no search. Escape regex characters, then case-insensitive
"contains" on `name` **or** `tagline`. `category` is a slug; unknown slug = no category filter.
Sort `newest` = `publishedAt` desc, `best` = `stats.salesCount` desc then `publishedAt` desc, price sorts then `publishedAt` desc.

**SEO files:** `app/sitemap.ts` (home, `/themes`, every category, every published theme, the 6 info pages; `APP_URL`
as base) and `app/robots.ts` (allow all, disallow `/account`, `/admin`, `/checkout`, `/api`; sitemap URL).
Theme page `generateMetadata`: title = theme name, description = tagline, `openGraph.images` = cover URL.

---

## 4. Account pages (customer)

Shell: `AccountShell` with menu: Overview `/account`, My themes `/account/themes`, Orders `/account/orders`,
Favorites `/account/favorites`, Notifications `/account/notifications` (unread count badge), Feedback
`/account/feedback`, Settings `/account/settings`. The current item is highlighted. On mobile the menu is a
horizontal scroll row above the content. **Admins see the same pages** plus a TextLink "Admin panel" → `/admin`.

| URL | Guard | Data | Content | Empty state |
|---|---|---|---|---|
| `/account` | `requireUser` | `getAccountOverview(userId)` → `{ ownedCount, unreadCount, latestNotifications (5), bestSellers (4 ThemeCardDTO), openWalletPayments (EG only) }` | Not verified → Alert warning "Please confirm your email address." + TextLink "Confirm email". Three stat Cards: "Themes owned", "Unread notifications", (EG) "Wallet payments waiting". Section "Latest notifications" (+ TextLink "See all"). Section "Best sellers" (Grid). EG users: Card "Pay with Vodafone Cash or InstaPay" explaining the wallet option is on each checkout page. | Notifications: "No notifications yet." |
| `/account/themes` | `requireUser` | `listOwnedThemes(userId)` → per active ownership: `{ theme: { name, slug, status, coverImage }, versions: VersionDTO[] }` sorted by theme name | `?downloadError=` alert (07 §7.2). One Card per theme: cover, name (link to theme page only when published; unpublished → Badge "No longer sold" and no link), latest version + date, `DownloadButton` "Download <version>", details/summary "Older versions" listing each older version with a small DownloadButton. Theme without any version: Text "The first version is coming soon." | "You do not own any themes yet." + ButtonLink "Browse themes" |
| `/account/orders` | `requireUser` | `listOrdersForUser(userId, page)`, `listWalletPaymentsForUser(userId)` | Table "Orders": date, theme, method ("Card" / "Wallet"), total (`formatPrice` in the order currency), status Badge ("Paid" success, "Partly refunded" warning, "Refunded" neutral). Section "Wallet payments": reference, theme, amount EGP, status Badge ("Waiting for payment", "Waiting for review", "Approved", "Rejected", "Cancelled"), TextLink "View" → `/account/wallet-payments/<id>`. Section hidden when the user has none. | "No orders yet." |
| `/account/favorites` | `requireUser` | `listFavorites(userId)` → themes (ThemeCardDTO, only published) + categories `{ name, slug }` | Section "Favorite themes" (Grid with a "Remove" button per card), section "Followed categories" (list with "Unfollow"). | "You have no favorite themes yet." / "You do not follow any category yet." |
| `/account/notifications?page=` | `requireUser` | `listNotifications(userId, page)` | Button "Mark all as read" (only when unread > 0). List: unread items have Badge "New"; title, body, date. Clicking an item runs `openNotificationAction(id)` which sets `readAt` and redirects to `link` (or stays when `null`). | "No notifications yet." |
| `/account/feedback` | `requireUser` | `listFeedbackForUser(userId)` | Form: TextField "Subject" (3–120), TextAreaField "Message" (10–5 000), SubmitButton "Send feedback" / "Sending…", success Alert "Thank you! We read every message." List of sent feedback: subject, date, status Badge ("Sent", "Read", "Resolved"), message, and the reply in a Card titled "Our reply" when present. | "You have not sent any feedback yet." |
| `/account/settings` | `requireUser` | `getAccountSettings(userId)` → name, email, country, `hasPassword` (account with providerId `credential` exists), 4 switches | Four Cards, each its own form: **Profile** (Name, Country select; email shown read-only), **Password** (only when `hasPassword`: Current password, New password, Confirm; Better Auth `changePassword` with `revokeOtherSessions: true`; success "Your password was changed."), **Email notifications** (4 CheckboxFields: "New versions of themes I own", "New versions of themes I favorited", "New themes in categories I follow", "Announcements from the store"; one SubmitButton "Save"), **Delete account**: Text "To delete your account, email <SUPPORT_EMAIL>." | — |

---

## 5. Admin pages

Every admin page and action calls `requireAdmin()` (non-admins get 404). Shell: `AdminShell` with menu:
Dashboard `/admin`, Themes `/admin/themes`, Categories `/admin/categories`, Orders `/admin/orders`,
Wallet payments `/admin/wallet-payments` (count badge of `submitted`), Customers `/admin/customers`,
Coupons `/admin/coupons`, Notifications `/admin/notifications`, Feedback `/admin/feedback` (count badge of `new`),
Activity `/admin/activity`, Settings `/admin/settings`, and TextLink "View store" → `/`.
Admin tables use `shared/ui/Table.tsx` (added by the first admin task: `Table`, `TableHead`, `TableRow`, `TableCell`).

| URL | Data | Content and actions |
|---|---|---|
| `/admin` | `getDashboard()` | 00 §4.1. Sales: two tables (USD card, EGP wallet), rows Today / 7 days / 30 days / All time, columns Orders, Revenue (net of refunds). Top themes: two lists (by sales, by downloads), each with a "30 days / All time" toggle via `?range=`. "Waiting for you": "<n> wallet payments to review" → `/admin/wallet-payments`, "<n> new feedback messages" → `/admin/feedback`. Latest activity: 20 rows (date, summary). |
| `/admin/themes?status=&q=&page=` | `listThemesForAdmin` | Tabs All / Draft / Published / Unpublished. Search by name. Table: cover thumb, name, status Badge, price, latest version, sales, downloads, updated date, TextLink "Edit". ButtonLink "New theme". Empty: "No themes yet." |
| `/admin/themes/new` | categories | `ThemeForm` (fields below). Submit "Create draft" → redirect `/admin/themes/<id>` with message "Draft created." |
| `/admin/themes/[id]` | `getThemeForAdmin(id)` | Header: name, status Badge, TextLink "View in store" (published only). **Publish checklist** Card: ✓/✗ "At least one version", "At least one image", "Synced to Polar" (with Button "Sync now" when ✗ and the theme has a price). Buttons "Publish" (enabled only when all ✓) / "Unpublish". Sections: `ThemeForm` (Save changes), `ThemeImagesManager` (07 §3), TextLink "Versions (<n>)" → versions page. |
| `/admin/themes/[id]/versions` | versions + jobs | ButtonLink "Upload new version" → `/new`. Table: version, date, size (MB, 1 decimal), SHA-256 (first 12 chars + copy button with full value), notify status (job status + counts), TextLink "Edit changelog". |
| `/admin/themes/[id]/versions/new` | theme | `VersionForm` (07 §4.1). |
| `/admin/themes/[id]/versions/[versionId]` | version | Changes editor (07 §4.4). |
| `/admin/categories` | `listCategoriesForAdmin` | Table: name, slug, theme count, sort order, TextLink "Edit". ButtonLink "New category". Empty: "No categories yet." |
| `/admin/categories/new`, `/admin/categories/[id]` | category | `CategoryForm`: Name, Slug (auto-filled from the name while the slug field is untouched; client), Description, Sort order. Edit page also has Button danger "Delete category" (refused when it has themes, 03 §4). |
| `/admin/orders?method=&status=&from=&to=&page=` | `listOrdersForAdmin` | Filters: method (All / Card / Wallet), status (All / Paid / Partly refunded / Refunded), from/to dates (`type="date"`, UTC days). Table: date, customer (link), theme, method, total, status. |
| `/admin/orders/[id]` | order | All amounts, coupon, customer, theme, provider ids, dates. Wallet + paid: Button danger "Mark as refunded" with confirm text "The customer loses access to the theme. Did you already send the money back?" (06 §7.6). |
| `/admin/wallet-payments?tab=` | list | Tabs: Waiting for review (`submitted`, oldest first), Approved, Rejected, Waiting for payment, Cancelled. Table: submitted date, customer, theme, amount EGP, reference, TextLink "Review". |
| `/admin/wallet-payments/[id]` | 06 §7.6 | As specified there. |
| `/admin/customers?q=&status=&page=` | `listCustomers` | Search name/email, filter Active / Disabled. Table: name, email, country, themes owned, joined date, status Badge. |
| `/admin/customers/[id]` | `getCustomerForAdmin(id)` | Details (name, email, verified, country, joined, status + reason). Sections: Owned themes (each with Button "Remove access" → form with required note 1–300 chars), Button "Give a theme" (select theme + note), Orders, Wallet payments, Feedback, Recent activity (20). Button "Disable account" (reason 1–300 chars) / "Enable account". Admin's own account: disable button hidden. |
| `/admin/coupons` | list | Table: code, discount ("20%" or "$5.00"), themes ("All themes" or count), used / limit, expires, active Badge, TextLink "Edit". ButtonLink "New coupon". |
| `/admin/coupons/new`, `/admin/coupons/[id]` | coupon | New: Code, Type (Percent / Fixed amount), value, Themes (All / Selected → checkbox list), Expires at (optional date), Usage limit (optional). Edit: only Active, Expires at, Usage limit editable; others read-only text (D-018). |
| `/admin/notifications` | announcement jobs | ButtonLink "New announcement". Table: date, title, audience, status, notified, emailed, Retry button for failed (09 §5.5). |
| `/admin/notifications/new` | themes, customers search | Form: Title (2–120), Message (2–1 000), Link (optional internal path), Audience (All customers / Owners of a theme → theme select / One customer → email field, must match an existing customer, else "No customer with this email."), CheckboxField "Also send by email". SubmitButton "Send announcement" → redirect to list with "Announcement queued." |
| `/admin/feedback?tab=` | list | Tabs New / Read / Resolved. Table: date, customer, subject, TextLink "Open". |
| `/admin/feedback/[id]` | feedback (opening a `new` one sets `read`) | Customer, date, subject, message. Reply form (2–5 000, "Send reply") — replying sets `reply`, notifies + emails (09 #11). Button "Mark as resolved" / "Reopen" (→ `read`). |
| `/admin/activity?action=&customer=&page=` | `listActivity` | Filters: action select (all 16 actions with readable labels), customer email. Table: date-time, actor ("System", "Admin", customer name), summary, link to the target when it has an admin page. |
| `/admin/settings` | settings | **Wallet payments** form: CheckboxField "Accept Egyptian wallet payments", TextField "USD → EGP rate" (e.g. 50.5), wallet accounts editor (1–5 rows: Label, Account, Instructions; add/remove row). Enabling with 0 accounts → "Add at least one wallet account first." |

**`ThemeForm` fields** (03 §5 limits): Name, Slug (editable only while never published; read-only text after),
Tagline, Category (select), Price (USD, TextField `type="number"` step 0.01, converted to cents on the server with
`Math.round(value × 100)`), Demo URL, Description (TextAreaField rows 12, hint "Markdown supported."), Features
(one per line in a TextAreaField; empty lines dropped), WordPress minimum, PHP minimum, Tested up to, CheckboxField "Featured on the home page".
