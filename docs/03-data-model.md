# 03 — Data model

This document lists **every MongoDB collection**, every field, every rule and every index.
Agents must not add, remove or rename fields. If you need a change, write it in `docs/QUESTIONS.md`.

Each model lives in its feature folder as `<singular>.model.ts` and follows the template in
`docs/02-architecture.md` section 5.1 (field comments, `InferSchemaType`, `<Name>Model` export).

---

## 1. General rules (apply to every model)

1. **IDs.** Every document has `_id: ObjectId` (MongoDB default). References to other documents
   are stored as `ObjectId`, never as strings.
2. **Timestamps.** Every model uses Mongoose `{ timestamps: true }`, which adds `createdAt` and `updatedAt`.
   They are not listed again in the tables below.
3. **Collection names are set explicitly** in each schema (`{ collection: "themes" }`).
   Use the exact name given in this document.
4. **Money** is always an integer number of US cents (`priceCents: 2900` = $29.00).
   Use `Number` with an integer validator. Never store floats or strings for money.
5. **Dates** are stored as `Date` (UTC). Never store dates as strings.
6. **Strings** are trimmed (`trim: true`) unless the table says otherwise.
7. **Enums** are defined once as a TypeScript `as const` array and reused by the Mongoose schema
   and the zod schema. Example:
   The list lives in the feature's `<singular>.constants.ts` file:
   ```ts
   export const THEME_STATUSES = ["draft", "published", "unpublished"] as const;
   export type ThemeStatus = (typeof THEME_STATUSES)[number];
   ```
8. **Nothing is hard-deleted** unless the table says "can be deleted". Themes are hidden with a status,
   coupons with `active: false`.
9. **Files** are stored as object keys (D-053), never as full URLs.
10. "Required" means Mongoose `required: true`. "Nullable" means the field always exists but its value may be `null`
    (default `null`). Never leave a field `undefined` in a saved document.
11. **Mongoose and zod must agree.** Every limit in these tables (min, max, regex) is enforced in **both**
    the zod input schema and the Mongoose schema.

### Shared validation formats

| Name | Rule | Example |
|---|---|---|
| `slug` | regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, length 2–80 | `aurora-blog` |
| `semver` | regex `^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$` | `1.4.0` |
| `wpVersion` | regex `^\d+\.\d+(\.\d+)?$` | `6.4`, `8.1.2` |
| `couponCode` | regex `^[A-Z0-9-]{3,32}$` (stored uppercase) | `BLACKFRIDAY-30` |
| `httpsUrl` | valid URL, must start with `https://`, max 500 chars | `https://demo.example.com/aurora` |

---

## 2. Overview

```
user (Better Auth) ──< ownerships >── themes ──< themeVersions
        │                   │            │
        └──────< orders >───┘            └── category (many themes → one category)
                    │
                 coupons (optional, one per order)

webhookEvents   (log of received payment webhooks, for idempotency)
downloadLogs    (one row per download)
```

| Collection | Model export | File | Managed by |
|---|---|---|---|
| `user`, `session`, `account`, `verification` | — (see section 3) | — | **Better Auth** |
| `categories` | `CategoryModel` | `features/categories/category.model.ts` | us |
| `themes` | `ThemeModel` | `features/themes/theme.model.ts` | us |
| `themeVersions` | `VersionModel` | `features/versions/version.model.ts` | us |
| `orders` | `OrderModel` | `features/orders/order.model.ts` | us |
| `ownerships` | `OwnershipModel` | `features/ownerships/ownership.model.ts` | us |
| `coupons` | `CouponModel` | `features/coupons/coupon.model.ts` | us |
| `webhookEvents` | `WebhookEventModel` | `features/payments/webhook-event.model.ts` | us |
| `downloadLogs` | `DownloadLogModel` | `features/downloads/download-log.model.ts` | us |

---

## 3. Better Auth collections (`user`, `session`, `account`, `verification`)

Better Auth creates and writes these collections itself through its MongoDB adapter.

- **Never write to these collections with Mongoose.** Change users only through Better Auth APIs.
- Reading users for the admin panel (list customers, show a customer) is done only in
  `features/users/user.repository.ts`, which is **read-only** (no insert/update/delete).
- `user._id` is the id that all our models store in their `userId` fields.

### Extra field we add to `user`

Configured with Better Auth `user.additionalFields`:

| Field | Type | Rules |
|---|---|---|
| `updateEmailsEnabled` | boolean | Default `true`. `input: false` (the user cannot set it at sign-up). Changed only in account settings or by the unsubscribe link. |

We do **not** store a role. A user is an admin when their email (lowercased) is in the `ADMIN_EMAILS`
environment variable (D-024).

> Planner note (not for the implementing agent): T-002 confirms how Better Auth's MongoDB adapter
> stores `_id` and `userId` (ObjectId vs string). This document assumes ObjectId. If it differs,
> this section is updated before any task that references users.

---

## 4. `categories` — `CategoryModel`

A group of themes, e.g. "Blog", "Business", "Shop".

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | yes | 2–40 chars. Unique (case-insensitive check in code). |
| `slug` | string | yes | `slug` format. Unique. |
| `description` | string | nullable | Max 300 chars. Shown on the category's theme-list page. |
| `sortOrder` | number | yes | Integer, default `0`. Lower shows first. |

**Indexes**
- `{ slug: 1 }` unique

**Rules**
- **Can be deleted** only if no theme (any status) has this `categoryId`. Otherwise the delete is refused with the error message
  `"This category still has themes. Move them to another category first."`
- The slug can be changed at any time (category pages are less important for links than theme pages).

---

## 5. `themes` — `ThemeModel`

One WordPress theme for sale.

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | yes | 2–80 chars. |
| `slug` | string | yes | `slug` format. Unique. Editable only while `status` is `draft` and `publishedAt` is `null` (D-017). |
| `status` | enum | yes | `"draft" \| "published" \| "unpublished"`. Default `"draft"`. |
| `tagline` | string | yes | 10–160 chars. Shown on theme cards and used as the meta description. |
| `description` | string | yes | Markdown. 50–20 000 chars. Not trimmed. |
| `features` | string[] | yes | 0–30 items, each 2–120 chars. Shown as a bullet list. Default `[]`. |
| `categoryId` | ObjectId → `categories` | yes | Must exist. |
| `priceCents` | number | yes | Integer, 100–100 000 ($1.00–$1 000.00). |
| `images` | `ThemeImage[]` | yes | 0–12 items. Order = display order. **The first image is the cover.** Default `[]`. |
| `demoUrl` | string | nullable | `httpsUrl` format. |
| `requirements.wordpressMin` | string | yes | `wpVersion` format. Example `"6.4"`. |
| `requirements.phpMin` | string | yes | `wpVersion` format. Example `"8.0"`. |
| `requirements.testedUpTo` | string | yes | `wpVersion` format. Latest WordPress version the theme was tested with. |
| `featured` | boolean | yes | Default `false`. Featured themes appear on the home page. |
| `latestVersion` | `LatestVersion` | nullable | Copy of the newest version's key data, for fast listing. Written **only** by the "create version" action. |
| `publishedAt` | Date | nullable | Set the **first** time the theme is published. Never changed after that. Used for "Newest" sorting. |
| `provider.productId` | string | nullable | ID of the matching product in the payment provider (Polar). |
| `provider.syncedAt` | Date | nullable | When the product was last successfully sent to the provider. |

### Sub-document `ThemeImage` (`{ _id: false }`)

| Field | Type | Rules |
|---|---|---|
| `key` | string | Object key in the **public** bucket. Format defined in `07-delivery-updates.md`. |
| `alt` | string | 0–150 chars. Default `""`. |
| `width` | number | Integer > 0. Pixel width (needed by `next/image`). |
| `height` | number | Integer > 0. |

### Sub-document `LatestVersion` (`{ _id: false }`)

| Field | Type | Rules |
|---|---|---|
| `versionId` | ObjectId → `themeVersions` | |
| `version` | string | `semver` format. |
| `releasedAt` | Date | |

**Indexes**
- `{ slug: 1 }` unique
- `{ status: 1, publishedAt: -1 }` (newest list)
- `{ status: 1, categoryId: 1, publishedAt: -1 }` (category list)
- `{ status: 1, priceCents: 1 }` (price sorting)
- `{ status: 1, featured: 1 }` (home page)

**Status rules**

| From → To | Allowed when |
|---|---|
| `draft` → `published` | `latestVersion` is not null **and** `images` has at least 1 item **and** `provider.productId` is not null. |
| `published` → `unpublished` | Always. |
| `unpublished` → `published` | Same checks as draft → published. |
| anything → `draft` | **Never.** |

- Visitors only see themes with `status: "published"`.
- Owners can download a theme in **any** status (D-016).
- Themes are never deleted.

---

## 6. `themeVersions` — `VersionModel`

One uploaded `.zip` of a theme. Never deleted, file never replaced (D-015).

| Field | Type | Required | Rules |
|---|---|---|---|
| `themeId` | ObjectId → `themes` | yes | |
| `version` | string | yes | `semver` format. Must be **greater** than the theme's current `latestVersion.version` (compare major, then minor, then patch). Unique per theme. |
| `changes` | `ChangeEntry[]` | yes | 1–50 items (D-019). |
| `file.key` | string | yes | Object key in the **private** bucket. Format in `07-delivery-updates.md`. |
| `file.sizeBytes` | number | yes | Integer, 1 – 209 715 200 (200 MB). |
| `file.sha256` | string | yes | Lowercase hex, 64 chars. Calculated by the server after upload. |
| `file.originalName` | string | yes | Name of the file the admin uploaded, max 200 chars. Not used for downloads. |
| `releasedAt` | Date | yes | Set to "now" when the version is created. |
| `notification.requested` | boolean | yes | `true` if the admin ticked "Email buyers about this update". |
| `notification.status` | enum | yes | `"not_requested" \| "pending" \| "sending" \| "done" \| "failed"`. |
| `notification.cursor` | ObjectId | nullable | Last `ownerships._id` already emailed. Lets the sender resume after a crash. |
| `notification.sentCount` | number | yes | Integer ≥ 0. Default `0`. |
| `notification.startedAt` | Date | nullable | |
| `notification.finishedAt` | Date | nullable | |
| `notification.error` | string | nullable | Last error message, max 500 chars. |

### Sub-document `ChangeEntry` (`{ _id: false }`)

| Field | Type | Rules |
|---|---|---|
| `type` | enum | `"new" \| "improved" \| "fixed" \| "removed"` |
| `text` | string | 2–200 chars. Plain text, no markdown. |

**Indexes**
- `{ themeId: 1, version: 1 }` unique
- `{ themeId: 1, releasedAt: -1 }` (changelog and version list, newest first)
- `{ "notification.status": 1 }` (the email sender looks for `pending` / `sending`)

**Rules**
- Because each new version must be higher than the last, sorting by `releasedAt` descending is the same as sorting by version.
- Only `changes` can be edited after creation. Editing changes does **not** send emails again.
- When a version is created, in the same operation:
  - `themes.latestVersion` is set to this version.
  - `notification.status` is `"pending"` if `notification.requested` is `true`, else `"not_requested"`.
- The notification state machine: `not_requested` (final) · `pending` → `sending` → `done` | `failed`.
  `failed` can be retried by the admin, which sets it back to `pending` (keeping `cursor`).

---

## 7. `orders` — `OrderModel`

One successful payment for one theme. Created **only** by the payment webhook (D-034).
Admin grants do **not** create orders.

| Field | Type | Required | Rules |
|---|---|---|---|
| `userId` | ObjectId → `user` | yes | |
| `themeId` | ObjectId → `themes` | yes | |
| `themeSnapshot.name` | string | yes | Theme name at the time of purchase. |
| `themeSnapshot.slug` | string | yes | Theme slug at the time of purchase. |
| `status` | enum | yes | `"paid" \| "partially_refunded" \| "refunded"`. |
| `currency` | string | yes | Always `"usd"` (D-008). |
| `subtotalCents` | number | yes | Integer ≥ 0. Price before discount. |
| `discountCents` | number | yes | Integer ≥ 0. Default `0`. |
| `taxCents` | number | yes | Integer ≥ 0. Default `0`. |
| `totalCents` | number | yes | Integer ≥ 0. What the customer paid, including tax. |
| `refundedCents` | number | yes | Integer ≥ 0. Default `0`. |
| `couponId` | ObjectId → `coupons` | nullable | |
| `couponCode` | string | nullable | Copy of the code used, for display even if the coupon changes. |
| `provider.name` | string | yes | `"polar"`. |
| `provider.orderId` | string | yes | Provider's order ID. **Unique.** |
| `provider.checkoutId` | string | nullable | Provider's checkout ID. Used by the checkout success page to find this order. |
| `provider.customerId` | string | nullable | Provider's customer ID. |
| `paidAt` | Date | yes | |
| `refundedAt` | Date | nullable | Set when `status` becomes `"refunded"`. |

**Indexes**
- `{ "provider.name": 1, "provider.orderId": 1 }` unique — stops the same order being saved twice
- `{ "provider.checkoutId": 1 }`
- `{ userId: 1, createdAt: -1 }` (My Orders)
- `{ createdAt: -1 }` (admin order list, dashboard)
- `{ themeId: 1 }`

**Status rules**
- `paid` → `partially_refunded` when `refundedCents > 0` and `refundedCents < totalCents`.
- `paid` / `partially_refunded` → `refunded` when `refundedCents >= totalCents`. This also revokes the ownership (D-011, D-014).
- `refunded` is final.

---

## 8. `ownerships` — `OwnershipModel`

"This user can download this theme." This is the **only** thing the download code checks.

| Field | Type | Required | Rules |
|---|---|---|---|
| `userId` | ObjectId → `user` | yes | |
| `themeId` | ObjectId → `themes` | yes | |
| `status` | enum | yes | `"active" \| "revoked"`. |
| `source` | enum | yes | `"purchase" \| "admin_grant"`. |
| `orderId` | ObjectId → `orders` | nullable | Required when `source` is `"purchase"`. `null` for admin grants. |
| `grantedByUserId` | ObjectId → `user` | nullable | Required when `source` is `"admin_grant"`. |
| `grantNote` | string | nullable | Max 300 chars. Admin's reason for the grant. |
| `licenseType` | enum | yes | Only `"standard"` (D-006). Default `"standard"`. |
| `revokedAt` | Date | nullable | |
| `revokedReason` | enum | nullable | `"refund"` (only value in MVP). |

**Indexes**
- `{ userId: 1, themeId: 1 }` unique — a user has **at most one** ownership per theme
- `{ themeId: 1, status: 1, _id: 1 }` (update-email sender walks owners of a theme in `_id` order)
- `{ userId: 1, status: 1 }` (My Themes)

**Rules**
- Because of the unique index, buying or granting a theme that has a **revoked** ownership **updates that same
  document**: `status = "active"`, new `source`/`orderId`/`grantedByUserId`/`grantNote`,
  `revokedAt = null`, `revokedReason = null`.
- If an ownership is already `active`, a new purchase webhook for the same user and theme still saves the order
  but does not change the ownership. (This can happen only if the user pays twice; the owner refunds it in Polar.)
- An admin grant is refused when an `active` ownership already exists, with the message
  `"This customer already owns this theme."`

---

## 9. `coupons` — `CouponModel`

| Field | Type | Required | Rules |
|---|---|---|---|
| `code` | string | yes | `couponCode` format. Converted to uppercase before validation. Unique. Fixed after creation (D-018). |
| `type` | enum | yes | `"percent" \| "fixed"`. Fixed after creation. |
| `percentOff` | number | nullable | Integer 1–100. Required when `type` is `"percent"`, else `null`. Fixed after creation. |
| `amountOffCents` | number | nullable | Integer 100–100 000. Required when `type` is `"fixed"`, else `null`. Fixed after creation. |
| `appliesTo` | enum | yes | `"all" \| "selected"`. Fixed after creation. |
| `themeIds` | ObjectId[] → `themes` | yes | 1–100 items when `appliesTo` is `"selected"`; must be `[]` when `"all"`. Fixed after creation. |
| `expiresAt` | Date | nullable | Editable. `null` = never expires. |
| `maxRedemptions` | number | nullable | Integer ≥ 1. Editable. `null` = unlimited. |
| `redemptionsCount` | number | yes | Integer ≥ 0. Default `0`. Increased by 1 by the webhook each time a paid order used this coupon. |
| `active` | boolean | yes | Default `true`. Editable. |
| `provider.discountId` | string | nullable | ID of the matching discount in the payment provider. |
| `provider.syncedAt` | Date | nullable | |

**Indexes**
- `{ code: 1 }` unique
- `{ active: 1, createdAt: -1 }` (admin list)

**Rules**
- The payment provider checks if the coupon is valid at checkout. Our fields are the source of truth and are
  copied to the provider when the coupon is created or edited (D-033). Details in `06-payments.md`.
- Coupons are never deleted. Use `active: false`.

---

## 10. `webhookEvents` — `WebhookEventModel`

A record of each payment webhook we received. Used to make processing idempotent (D-035).
**Do not store the webhook body** (it contains personal data).

| Field | Type | Required | Rules |
|---|---|---|---|
| `provider` | string | yes | `"polar"`. |
| `eventId` | string | yes | The unique event ID sent by the provider (for Polar: the `webhook-id` header). |
| `type` | string | yes | Event type, e.g. `"order.paid"`. Max 100 chars. |
| `status` | enum | yes | `"processing" \| "processed" \| "ignored" \| "failed"`. |
| `error` | string | nullable | Max 1 000 chars. No secrets, no personal data. |
| `processedAt` | Date | nullable | |

**Indexes**
- `{ provider: 1, eventId: 1 }` unique
- `{ createdAt: 1 }` with `expireAfterSeconds: 7776000` (90 days — MongoDB deletes old rows automatically)

The exact processing steps (insert first, skip if duplicate, retry on `failed`) are in `06-payments.md`.

---

## 11. `downloadLogs` — `DownloadLogModel`

One row each time a customer gets a download link.

| Field | Type | Required | Rules |
|---|---|---|---|
| `userId` | ObjectId → `user` | yes | |
| `themeId` | ObjectId → `themes` | yes | |
| `versionId` | ObjectId → `themeVersions` | yes | |

**Indexes**
- `{ userId: 1, createdAt: -1 }` (rate limit check: downloads per user in the last hour)
- `{ themeId: 1, createdAt: -1 }` (admin: download counts)

The rate limit value is defined in `07-delivery-updates.md`. Rows are kept forever (they are very small).

---

## 12. What happens in the database for each main event

These are the only writes allowed for these events. Each list runs in a **MongoDB transaction**
(Atlas supports transactions).

**Admin creates a version**
1. Insert `themeVersions` document.
2. Update `themes.latestVersion`.

**Webhook: order paid**
1. Insert `webhookEvents` (`processing`). If the unique index rejects it and the existing row is `processed`, stop.
2. Insert `orders` (`paid`). If the unique index on `provider.orderId` rejects it, skip to step 5.
3. Upsert `ownerships` (rules in section 8).
4. If a coupon was used: `coupons.redemptionsCount += 1`.
5. Set `webhookEvents.status = "processed"`.

**Webhook: refund**
1. Same `webhookEvents` step as above.
2. Update `orders.refundedCents`, `status`, `refundedAt` (rules in section 7).
3. If the order became `refunded`: set the matching ownership to `revoked`, `revokedReason: "refund"`,
   but **only** if that ownership's `orderId` equals this order's `_id`.
4. Set `webhookEvents.status = "processed"`.

**Admin grants a theme**
1. Upsert `ownerships` with `source: "admin_grant"` (rules in section 8).

**Customer downloads**
1. Check an `active` ownership exists for (user, theme).
2. Check the rate limit using `downloadLogs`.
3. Insert `downloadLogs`.
4. Return a signed URL (no database write).
