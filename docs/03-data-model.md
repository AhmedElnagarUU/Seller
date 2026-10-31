# 03 — Data model

This document lists **every MongoDB collection**, every field, every rule and every index.
Agents must not add, remove or rename fields. If you need a change, write it in `docs/QUESTIONS.md`.

Each model lives in its feature folder as `<singular>.model.ts` and follows the template in
`docs/02-architecture.md` section 5.1 (field comments, `InferSchemaType`, `<Name>Model` export).

---

## 1. General rules (apply to every model)

1. **IDs.** Every document has `_id: ObjectId` (MongoDB default), except `settings` (section 18).
   References to other documents are stored as `ObjectId`, never as strings.
2. **Timestamps.** Every model uses Mongoose `{ timestamps: true }`, which adds `createdAt` and `updatedAt`.
   They are not listed again in the tables below.
3. **Collection names are set explicitly** in each schema (`{ collection: "themes" }`).
   Use the exact name given in this document.
4. **Money** is always an integer in the **minor unit** of its currency: cents for USD (`2900` = $29.00),
   piasters for EGP (`145000` = 1,450 EGP). Field names say which: `priceCents` is always USD;
   fields named `...Amount` are in the currency stored next to them. Never store floats or strings for money.
5. **Dates** are stored as `Date` (UTC). Never store dates as strings.
6. **Strings** are trimmed (`trim: true`) unless the table says otherwise.
7. **Enums** are defined once as a TypeScript `as const` array in the feature's `<singular>.constants.ts`
   and reused by the Mongoose schema and the zod schema:
   ```ts
   export const THEME_STATUSES = ["draft", "published", "unpublished"] as const;
   export type ThemeStatus = (typeof THEME_STATUSES)[number];
   ```
8. **Nothing is hard-deleted** unless the table says "can be deleted".
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
| `internalPath` | starts with `/`, not `//`, max 300 chars | `/account/themes` |
| `countryCode` | regex `^[A-Z]{2}$` (ISO 3166-1 alpha-2) | `EG`, `US` |
| `egyptMobile` | regex `^01[0125]\d{8}$` | `01012345678` |
| `walletReference` | regex `^TS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$` (no 0, O, 1, I) | `TS-7K3P9Q` |

---

## 2. Overview

```
                     ┌──────────── favorites (theme or category) ─────────────┐
                     │                                                        │
user (Better Auth) ──┼──< ownerships >── themes ──< themeVersions             │
   │                 │        │            │  └──── categories <──────────────┘
   │                 └──< orders >─────────┘
   │                        │  └── coupons (optional)
   │                        └── walletPayments (wallet orders come from an approved request)
   ├──< notifications ──── notificationJobs (fan-out to many users)
   ├──< feedback
   └──< activityLogs

webhookEvents   payment webhooks received (idempotency)
downloadLogs    one row per download
settings        one document: wallet settings
```

| Collection | Model export | File | Managed by |
|---|---|---|---|
| `user` | `UserModel` (limited, section 3) | `features/users/user.model.ts` | **Better Auth** + our extra fields |
| `session`, `account`, `verification` | — | — | **Better Auth** |
| `categories` | `CategoryModel` | `features/categories/category.model.ts` | us |
| `themes` | `ThemeModel` | `features/themes/theme.model.ts` | us |
| `themeVersions` | `VersionModel` | `features/versions/version.model.ts` | us |
| `orders` | `OrderModel` | `features/orders/order.model.ts` | us |
| `ownerships` | `OwnershipModel` | `features/ownerships/ownership.model.ts` | us |
| `coupons` | `CouponModel` | `features/coupons/coupon.model.ts` | us |
| `walletPayments` | `WalletPaymentModel` | `features/wallet-payments/wallet-payment.model.ts` | us |
| `favorites` | `FavoriteModel` | `features/favorites/favorite.model.ts` | us |
| `notifications` | `NotificationModel` | `features/notifications/notification.model.ts` | us |
| `notificationJobs` | `NotificationJobModel` | `features/notifications/notification-job.model.ts` | us |
| `feedback` | `FeedbackModel` | `features/feedback/feedback.model.ts` | us |
| `activityLogs` | `ActivityLogModel` | `features/activity/activity-log.model.ts` | us |
| `webhookEvents` | `WebhookEventModel` | `features/payments/webhook-event.model.ts` | us |
| `downloadLogs` | `DownloadLogModel` | `features/downloads/download-log.model.ts` | us |
| `settings` | `SettingsModel` | `features/settings/settings.model.ts` | us |

---

## 3. `user` (Better Auth) — `UserModel`

Better Auth creates users and owns their core fields (`name`, `email`, `emailVerified`, `image`, password in `account`).

- **Core fields are changed only through Better Auth APIs** (sign-up, change password, …).
- `features/users/user.repository.ts` is the **only** file that touches the `user` collection with Mongoose. It may:
  - read any field;
  - update **only our extra fields** listed below;
  - delete a user's documents in the `session` collection (when an account is disabled — D-120).
- Better Auth's session **cookie cache is turned off**, so changes to these fields take effect on the next request.
- `user._id` is the id that all our models store in their `userId` fields.

### Extra fields we add to `user`

Configured with Better Auth `user.additionalFields` (all `input: false`, so a user cannot set them through the
sign-up API; our code sets them). Fields are flat because Better Auth additional fields do not support nested objects.

| Field | Type | Rules |
|---|---|---|
| `country` | string | nullable. `countryCode` format. Set at registration or first checkout (D-102). |
| `disabled` | boolean | Default `false`. `true` = cannot log in (D-120). |
| `disabledReason` | string | nullable. Max 300 chars. Shown to the admin only. |
| `disabledAt` | Date | nullable. |
| `emailOwnedThemeUpdates` | boolean | Default `true`. |
| `emailFavoriteThemeUpdates` | boolean | Default `true`. |
| `emailFollowedCategoryThemes` | boolean | Default `true`. |
| `emailAnnouncements` | boolean | Default `true`. |

**Indexes we add** (created by `user.model.ts`; Better Auth already makes `email` unique)
- `{ disabled: 1, createdAt: -1 }` (admin customer list filter)

We do **not** store a role. A user is an admin when their email (lowercased) is in `ADMIN_EMAILS` (D-024).

> Planner note (not for the implementing agent): T-002 confirms (1) how Better Auth's MongoDB adapter stores
> `_id` and `userId` (ObjectId vs string), (2) the session hook used to block disabled users (D-121),
> (3) that the extra fields above are returned in the session user. This section is updated before any task
> that depends on it.

---

## 4. `categories` — `CategoryModel`

A group of themes, e.g. "Blog", "Business", "Shop".

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | yes | 2–40 chars. Unique (case-insensitive check in code). |
| `slug` | string | yes | `slug` format. Unique. |
| `description` | string | nullable | Max 300 chars. Shown on the category page. |
| `sortOrder` | number | yes | Integer, default `0`. Lower shows first. |

**Indexes**
- `{ slug: 1 }` unique

**Rules**
- **Can be deleted** only if no theme (any status) has this `categoryId`. Otherwise refused with
  `"This category still has themes. Move them to another category first."`
  Deleting a category also deletes its `favorites` rows (`targetType: "category"`).

---

## 5. `themes` — `ThemeModel`

One WordPress theme for sale.

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | yes | 2–80 chars. |
| `slug` | string | yes | `slug` format. Unique. Editable only while `publishedAt` is `null` (D-017). |
| `status` | enum | yes | `"draft" \| "published" \| "unpublished"`. Default `"draft"`. |
| `tagline` | string | yes | 10–160 chars. Shown on cards, used as meta description, searched. |
| `description` | string | yes | Markdown. 50–20 000 chars. Not trimmed. |
| `features` | string[] | yes | 0–30 items, each 2–120 chars. Default `[]`. |
| `categoryId` | ObjectId → `categories` | yes | Must exist. |
| `priceCents` | number | yes | USD. Integer, 100–100 000 ($1.00–$1 000.00). |
| `images` | `ThemeImage[]` | yes | 0–12 items. Order = display order. **The first image is the cover.** Default `[]`. |
| `demoUrl` | string | nullable | `httpsUrl` format. |
| `requirements.wordpressMin` | string | yes | `wpVersion` format. |
| `requirements.phpMin` | string | yes | `wpVersion` format. |
| `requirements.testedUpTo` | string | yes | `wpVersion` format. |
| `featured` | boolean | yes | Default `false`. |
| `latestVersion` | `LatestVersion` | nullable | Copy of the newest version's key data. Written **only** by "create version". |
| `publishedAt` | Date | nullable | Set the **first** time the theme is published. Never changed after. |
| `stats.salesCount` | number | yes | Integer ≥ 0, default `0`. Paid, non-refunded orders (both methods). |
| `stats.downloadCount` | number | yes | Integer ≥ 0, default `0`. Every download. |
| `provider.productId` | string | nullable | Matching product id at Polar. |
| `provider.syncedAt` | Date | nullable | Last successful sync to Polar. |

### Sub-document `ThemeImage` (`{ _id: false }`)

| Field | Type | Rules |
|---|---|---|
| `key` | string | Object key in the **public** bucket (`07-delivery-updates.md`). |
| `alt` | string | 0–150 chars. Default `""`. |
| `width` | number | Integer > 0. |
| `height` | number | Integer > 0. |

### Sub-document `LatestVersion` (`{ _id: false }`)

| Field | Type | Rules |
|---|---|---|
| `versionId` | ObjectId → `themeVersions` | |
| `version` | string | `semver` format. |
| `releasedAt` | Date | |

**Indexes**
- `{ slug: 1 }` unique
- `{ status: 1, publishedAt: -1 }` (newest)
- `{ status: 1, categoryId: 1, publishedAt: -1 }` (category list)
- `{ status: 1, priceCents: 1 }` (price sort)
- `{ status: 1, "stats.salesCount": -1 }` (best sellers)
- `{ status: 1, featured: 1 }` (home page)

**Status rules**

| From → To | Allowed when |
|---|---|
| `draft` → `published` | `latestVersion` not null **and** at least 1 image **and** `provider.productId` not null. |
| `published` → `unpublished` | Always. |
| `unpublished` → `published` | Same checks as draft → published. |
| anything → `draft` | **Never.** |

- Visitors only see `published` themes. Owners can download a theme in **any** status (D-016).
- The **first** publish (when `publishedAt` was `null`) creates a notification job for category followers (section 13).
- Themes are never deleted.
- `stats.salesCount`: +1 when an order for this theme is created, −1 when that order becomes `refunded`.
- `stats.downloadCount`: +1 for every `downloadLogs` row.

---

## 6. `themeVersions` — `VersionModel`

One uploaded `.zip` of a theme. Never deleted, file never replaced (D-015).

| Field | Type | Required | Rules |
|---|---|---|---|
| `themeId` | ObjectId → `themes` | yes | |
| `version` | string | yes | `semver`. Must be **greater** than the theme's current `latestVersion.version`. Unique per theme. |
| `changes` | `ChangeEntry[]` | yes | 1–50 items (D-019). |
| `file.key` | string | yes | Object key in the **private** bucket. |
| `file.sizeBytes` | number | yes | Integer, 1 – 209 715 200 (200 MB). |
| `file.sha256` | string | yes | Lowercase hex, 64 chars. Calculated by the server after upload. |
| `file.originalName` | string | yes | Max 200 chars. Not used for downloads. |
| `releasedAt` | Date | yes | "Now" when created. |
| `notifyRequested` | boolean | yes | Admin ticked "Notify owners and people who favorited this theme". |
| `notificationJobId` | ObjectId → `notificationJobs` | nullable | Set when `notifyRequested` is `true`. |

### Sub-document `ChangeEntry` (`{ _id: false }`)

| Field | Type | Rules |
|---|---|---|
| `type` | enum | `"new" \| "improved" \| "fixed" \| "removed"` |
| `text` | string | 2–200 chars. Plain text. |

**Indexes**
- `{ themeId: 1, version: 1 }` unique
- `{ themeId: 1, releasedAt: -1 }`

**Rules**
- Sorting by `releasedAt` descending equals sorting by version (each new one is higher).
- Only `changes` can be edited after creation. Editing does **not** notify again.

---

## 7. `orders` — `OrderModel`

One successful payment for one theme, by card (Polar) or by wallet (approved request).
Admin grants do **not** create orders.

| Field | Type | Required | Rules |
|---|---|---|---|
| `userId` | ObjectId → `user` | yes | |
| `themeId` | ObjectId → `themes` | yes | |
| `themeSnapshot.name` | string | yes | Theme name at purchase time. |
| `themeSnapshot.slug` | string | yes | Theme slug at purchase time. |
| `method` | enum | yes | `"card" \| "wallet"`. |
| `status` | enum | yes | `"paid" \| "partially_refunded" \| "refunded"`. |
| `currency` | enum | yes | `"usd"` for card, `"egp"` for wallet. |
| `subtotalAmount` | number | yes | Integer ≥ 0, minor units of `currency`. Before discount. |
| `discountAmount` | number | yes | Integer ≥ 0. Default `0`. |
| `taxAmount` | number | yes | Integer ≥ 0. Default `0` (always `0` for wallet). |
| `totalAmount` | number | yes | Integer ≥ 0. What the customer paid. |
| `refundedAmount` | number | yes | Integer ≥ 0. Default `0`. |
| `couponId` | ObjectId → `coupons` | nullable | |
| `couponCode` | string | nullable | Copy of the code used. |
| `walletPaymentId` | ObjectId → `walletPayments` | nullable | Required when `method` is `"wallet"`. |
| `provider.name` | enum | yes | `"polar" \| "fake" \| "manual_wallet"`. |
| `provider.orderId` | string | yes | Polar order id; for wallet = the wallet payment's `_id` as string. **Unique per provider.** |
| `provider.checkoutId` | string | nullable | Polar checkout id (success page lookup). |
| `provider.customerId` | string | nullable | Polar customer id. |
| `paidAt` | Date | yes | |
| `refundedAt` | Date | nullable | Set when `status` becomes `"refunded"`. |

**Indexes**
- `{ "provider.name": 1, "provider.orderId": 1 }` unique — the same order is never saved twice
- `{ "provider.checkoutId": 1 }`
- `{ userId: 1, createdAt: -1 }`
- `{ createdAt: -1 }`
- `{ currency: 1, paidAt: -1 }` (dashboard revenue per currency)
- `{ themeId: 1, paidAt: -1 }` (top themes)

**Status rules**
- `paid` → `partially_refunded` when `0 < refundedAmount < totalAmount`.
- `paid` / `partially_refunded` → `refunded` when `refundedAmount >= totalAmount`. This revokes the ownership
  **if** the ownership's `orderId` is this order (D-011, D-014) and does `themes.stats.salesCount -= 1`.
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
| `orderId` | ObjectId → `orders` | nullable | Required when `source` is `"purchase"`. |
| `grantedByUserId` | ObjectId → `user` | nullable | Required when `source` is `"admin_grant"`. |
| `grantNote` | string | nullable | Max 300 chars. |
| `licenseType` | enum | yes | Only `"standard"` (D-006). Default `"standard"`. |
| `revokedAt` | Date | nullable | |
| `revokedReason` | enum | nullable | `"refund" \| "admin"`. |
| `revokedByUserId` | ObjectId → `user` | nullable | Required when `revokedReason` is `"admin"`. |
| `revokeNote` | string | nullable | Max 300 chars. Required when `revokedReason` is `"admin"`. |

**Indexes**
- `{ userId: 1, themeId: 1 }` unique — at most one ownership per user and theme
- `{ themeId: 1, status: 1, _id: 1 }` (notification fan-out walks owners in `_id` order)
- `{ userId: 1, status: 1 }`

**Rules**
- Buying or granting a theme with a **revoked** ownership **updates that same document**: `status = "active"`,
  new `source`/`orderId`/`grantedByUserId`/`grantNote`, and all `revoked*` fields set to `null`.
- If an ownership is already `active`, a new paid order still saves the order but does not change the ownership.
- Admin grant when `active` already exists → refused: `"This customer already owns this theme."`
- Admin revoke when already `revoked` → refused: `"This customer does not own this theme."`

---

## 9. `coupons` — `CouponModel`

| Field | Type | Required | Rules |
|---|---|---|---|
| `code` | string | yes | `couponCode` format, uppercased first. Unique. Fixed after creation (D-018). |
| `type` | enum | yes | `"percent" \| "fixed"`. Fixed after creation. |
| `percentOff` | number | nullable | Integer 1–100. Required for `"percent"`, else `null`. |
| `amountOffCents` | number | nullable | USD cents, integer 100–100 000. Required for `"fixed"`, else `null`. |
| `appliesTo` | enum | yes | `"all" \| "selected"`. Fixed after creation. |
| `themeIds` | ObjectId[] → `themes` | yes | 1–100 items when `"selected"`; `[]` when `"all"`. Fixed after creation. |
| `expiresAt` | Date | nullable | Editable. `null` = never. |
| `maxRedemptions` | number | nullable | Integer ≥ 1. Editable. `null` = unlimited. |
| `redemptionsCount` | number | yes | Integer ≥ 0, default `0`. +1 each time an order (card or wallet) is created with this coupon. |
| `active` | boolean | yes | Default `true`. Editable. |
| `provider.discountId` | string | nullable | Matching discount id at Polar. |
| `provider.syncedAt` | Date | nullable | |

**Indexes**
- `{ code: 1 }` unique
- `{ active: 1, createdAt: -1 }`

**Rules**
- Our server checks validity (rules in `06-payments.md` section 4) for both methods.
- Coupons are never deleted. Use `active: false`.

---

## 10. `walletPayments` — `WalletPaymentModel`

A customer's request to buy a theme by Egyptian wallet transfer (D-100).

| Field | Type | Required | Rules |
|---|---|---|---|
| `userId` | ObjectId → `user` | yes | |
| `themeId` | ObjectId → `themes` | yes | |
| `themeSnapshot.name` | string | yes | |
| `themeSnapshot.slug` | string | yes | |
| `referenceCode` | string | yes | `walletReference` format. Unique. Generated by the server. |
| `status` | enum | yes | `"awaiting_payment" \| "submitted" \| "approved" \| "rejected" \| "cancelled"`. |
| `isOpen` | boolean | yes | `true` while status is `awaiting_payment` or `submitted`; `false` otherwise. Kept in sync by the service. |
| `usdPriceCents` | number | yes | Theme price at creation. |
| `usdDiscountCents` | number | yes | Integer ≥ 0. Default `0`. |
| `couponId` | ObjectId → `coupons` | nullable | |
| `couponCode` | string | nullable | |
| `exchangeRate` | number | yes | USD → EGP rate used, 1–1000, max 2 decimals. Copied from settings at creation. |
| `amountEgp` | number | yes | Whole pounds, integer ≥ 1. `ceil((usdPriceCents − usdDiscountCents) / 100 × exchangeRate)` (D-101). |
| `senderPhone` | string | nullable | `egyptMobile` format. Required to move to `submitted`. |
| `transactionId` | string | nullable | Max 100 chars. Optional. |
| `proof.key` | string | nullable | Private bucket key of the screenshot. Required to move to `submitted`. |
| `proof.contentType` | enum | nullable | `"image/jpeg" \| "image/png" \| "image/webp"`. |
| `proof.sizeBytes` | number | nullable | Integer 1 – 5 242 880 (5 MB). |
| `submittedAt` | Date | nullable | |
| `reviewedAt` | Date | nullable | |
| `reviewedByUserId` | ObjectId → `user` | nullable | |
| `rejectionReason` | string | nullable | 5–500 chars. Required when `rejected`. Shown to the customer. |
| `orderId` | ObjectId → `orders` | nullable | Set on approval. |

**Indexes**
- `{ referenceCode: 1 }` unique
- `{ userId: 1, themeId: 1 }` unique, **partial** `{ isOpen: true }` — at most one open request per user and theme
- `{ status: 1, submittedAt: 1 }` (admin review queue, oldest first)
- `{ userId: 1, createdAt: -1 }`

**Status rules**

| From → To | Who | When |
|---|---|---|
| (new) → `awaiting_payment` | customer | Country is `EG`, wallet enabled in settings, theme published, no active ownership. If an open request already exists for this theme, return it instead of creating a new one. |
| `awaiting_payment` → `submitted` | customer | `senderPhone` and `proof` are given. |
| `awaiting_payment` → `cancelled` | customer | Any time. |
| `submitted` → `approved` | admin | Creates the order + ownership (section 13). |
| `submitted` → `rejected` | admin | `rejectionReason` given. |
| `approved`, `rejected`, `cancelled` | — | Final. |

---

## 11. `favorites` — `FavoriteModel`

A favorited theme or a followed category (D-110).

| Field | Type | Required | Rules |
|---|---|---|---|
| `userId` | ObjectId → `user` | yes | |
| `targetType` | enum | yes | `"theme" \| "category"`. |
| `targetId` | ObjectId | yes | A theme id or category id, depending on `targetType`. Must exist. |

**Indexes**
- `{ userId: 1, targetType: 1, targetId: 1 }` unique
- `{ targetType: 1, targetId: 1, _id: 1 }` (notification fan-out)

**Rules**
- **Can be deleted** (unfavorite / unfollow deletes the row).
- Favoriting something already favorited does nothing (no error).
- Only `published` themes can be favorited.

---

## 12. `notifications` — `NotificationModel`

One message in one customer's notification center (D-111).

| Field | Type | Required | Rules |
|---|---|---|---|
| `userId` | ObjectId → `user` | yes | |
| `type` | enum | yes | `"owned_theme_updated" \| "favorite_theme_updated" \| "category_new_theme" \| "announcement" \| "wallet_payment_approved" \| "wallet_payment_rejected" \| "feedback_reply"`. |
| `title` | string | yes | 2–120 chars. |
| `body` | string | yes | 2–1 000 chars. Plain text. |
| `link` | string | nullable | `internalPath` format. Where clicking the notification goes. |
| `readAt` | Date | nullable | `null` = unread. |
| `jobId` | ObjectId → `notificationJobs` | nullable | Set when created by a job. |

**Indexes**
- `{ userId: 1, createdAt: -1 }` (notification page)
- `{ userId: 1, readAt: 1 }` (unread count)
- `{ jobId: 1, userId: 1 }` unique, **partial** `{ jobId: { $type: "objectId" } }` — a job never notifies the same user twice
- `{ createdAt: 1 }` with `expireAfterSeconds: 31536000` (deleted after 1 year)

---

## 13. `notificationJobs` — `NotificationJobModel`

A notification that must reach **many** users. Created in the admin's request; processed in batches by the cron
route (D-116). Processing details are in `09-emails.md`.

| Field | Type | Required | Rules |
|---|---|---|---|
| `kind` | enum | yes | `"version_released" \| "theme_published" \| "announcement"`. |
| `themeId` | ObjectId → `themes` | nullable | Required for `version_released`, `theme_published`. |
| `versionId` | ObjectId → `themeVersions` | nullable | Required for `version_released`. |
| `categoryId` | ObjectId → `categories` | nullable | Required for `theme_published`. |
| `announcement.title` | string | nullable | 2–120 chars. Required for `announcement`. |
| `announcement.body` | string | nullable | 2–1 000 chars. Required for `announcement`. |
| `announcement.link` | string | nullable | `internalPath`. |
| `announcement.sendEmail` | boolean | nullable | Required for `announcement`. |
| `announcement.audience` | enum | nullable | `"all_customers" \| "theme_owners" \| "one_customer"`. Required for `announcement`. |
| `announcement.audienceThemeId` | ObjectId → `themes` | nullable | Required when audience is `theme_owners`. |
| `announcement.audienceUserId` | ObjectId → `user` | nullable | Required when audience is `one_customer`. |
| `status` | enum | yes | `"pending" \| "running" \| "done" \| "failed"`. Default `"pending"`. |
| `stage` | enum | yes | Which group is being processed now (table below). Starts at the first stage of the kind. |
| `cursor` | ObjectId | nullable | `_id` of the last source row processed in the current stage. |
| `notifiedCount` | number | yes | Integer ≥ 0, default `0`. |
| `emailedCount` | number | yes | Integer ≥ 0, default `0`. |
| `attempts` | number | yes | Integer ≥ 0, default `0`. Failed batches; after 5 the job becomes `failed`. |
| `error` | string | nullable | Max 500 chars. |
| `startedAt` | Date | nullable | |
| `finishedAt` | Date | nullable | |
| `createdByUserId` | ObjectId → `user` | yes | The admin who caused it. |

**Stages per kind** (processed in this order; a user reached in an earlier stage is skipped later thanks to the
unique `{ jobId, userId }` index on `notifications`)

| Kind | Stage 1 | Stage 2 |
|---|---|---|
| `version_released` | `theme_owners` (active ownerships) → type `owned_theme_updated`, email if `emailOwnedThemeUpdates` | `theme_favoriters` → type `favorite_theme_updated`, email if `emailFavoriteThemeUpdates` |
| `theme_published` | `category_followers` → type `category_new_theme`, email if `emailFollowedCategoryThemes` | — |
| `announcement` | `all_customers` **or** `theme_owners` **or** `one_customer` (from `audience`) → type `announcement`, email if `sendEmail` **and** `emailAnnouncements` | — |

Disabled users are skipped in every stage.

**Indexes**
- `{ status: 1, createdAt: 1 }` (cron picks the oldest `pending`/`running` job)

---

## 14. `feedback` — `FeedbackModel`

| Field | Type | Required | Rules |
|---|---|---|---|
| `userId` | ObjectId → `user` | yes | |
| `subject` | string | yes | 3–120 chars. |
| `message` | string | yes | 10–5 000 chars. Not trimmed inside (only ends). |
| `status` | enum | yes | `"new" \| "read" \| "resolved"`. Default `"new"`. |
| `reply` | string | nullable | 2–5 000 chars. |
| `repliedAt` | Date | nullable | |
| `repliedByUserId` | ObjectId → `user` | nullable | |

**Indexes**
- `{ status: 1, createdAt: -1 }`
- `{ userId: 1, createdAt: -1 }`

**Rules**
- A customer may send at most **5 feedback messages per 24 hours**. The 6th is refused:
  `"You have sent a lot of feedback today. Please try again tomorrow."`
- Admin opening a `new` message sets it to `read`. Replying creates a `feedback_reply` notification and email.

---

## 15. `activityLogs` — `ActivityLogModel`

| Field | Type | Required | Rules |
|---|---|---|---|
| `action` | enum | yes | `"user_registered" \| "order_paid" \| "order_refunded" \| "wallet_payment_submitted" \| "wallet_payment_approved" \| "wallet_payment_rejected" \| "feedback_sent" \| "theme_published" \| "theme_unpublished" \| "version_released" \| "coupon_created" \| "account_disabled" \| "account_enabled" \| "ownership_granted" \| "ownership_revoked" \| "announcement_sent"`. |
| `actorRole` | enum | yes | `"customer" \| "admin" \| "system"` (`system` = webhooks, cron). |
| `actorUserId` | ObjectId → `user` | nullable | `null` when `actorRole` is `system`. |
| `subjectUserId` | ObjectId → `user` | nullable | The customer this is about (used by the customer filter). |
| `targetType` | enum | nullable | `"theme" \| "order" \| "wallet_payment" \| "feedback" \| "coupon" \| "user" \| "notification_job"`. |
| `targetId` | ObjectId | nullable | |
| `summary` | string | yes | 2–300 chars. A readable sentence, e.g. `"Order paid: Aurora Blog ($29.00)"`. No secrets. |

**Indexes**
- `{ createdAt: 1 }` with `expireAfterSeconds: 31536000` (1 year, D-123) — also used for newest-first sorting
- `{ subjectUserId: 1, createdAt: -1 }`
- `{ action: 1, createdAt: -1 }`

**Rules**
- Written only through `activityService.log(...)`. Inside a transaction it receives the same `session`.
- Logging never blocks the main action in a way the user sees: if it fails **outside** a transaction, the error is
  logged with `console.error` and the main action still succeeds.

---

## 16. `webhookEvents` — `WebhookEventModel`

| Field | Type | Required | Rules |
|---|---|---|---|
| `provider` | string | yes | `"polar"` or `"fake"`. |
| `eventId` | string | yes | Provider's unique event id (Polar: `webhook-id` header). |
| `type` | string | yes | e.g. `"order.paid"`. Max 100 chars. |
| `status` | enum | yes | `"processing" \| "processed" \| "ignored" \| "failed"`. |
| `error` | string | nullable | Max 1 000 chars. No secrets, no personal data. |
| `processedAt` | Date | nullable | |

**Indexes**
- `{ provider: 1, eventId: 1 }` unique
- `{ createdAt: 1 }` with `expireAfterSeconds: 7776000` (90 days)

Never store the webhook body.

---

## 17. `downloadLogs` — `DownloadLogModel`

| Field | Type | Required | Rules |
|---|---|---|---|
| `userId` | ObjectId → `user` | yes | |
| `themeId` | ObjectId → `themes` | yes | |
| `versionId` | ObjectId → `themeVersions` | yes | |

**Indexes**
- `{ userId: 1, createdAt: -1 }` (rate limit)
- `{ themeId: 1, createdAt: -1 }` (top themes by downloads)

---

## 18. `settings` — `SettingsModel`

Exactly **one** document with `_id: "global"` (string `_id`, not ObjectId). If it does not exist, the service creates it with the defaults.

| Field | Type | Required | Rules |
|---|---|---|---|
| `_id` | string | yes | Always `"global"`. |
| `walletEnabled` | boolean | yes | Default `false`. |
| `usdToEgpRate` | number | yes | 1–1000, max 2 decimals. Default `50`. |
| `walletAccounts` | `WalletAccount[]` | yes | 0–5 items. Default `[]`. Must have ≥ 1 item to set `walletEnabled` to `true`. |

### Sub-document `WalletAccount` (`{ _id: false }`)

| Field | Type | Rules |
|---|---|---|
| `label` | string | 2–40 chars, e.g. `"Vodafone Cash"`, `"InstaPay"`. |
| `account` | string | 2–100 chars, e.g. `"01012345678"` or `"name@instapay"`. |
| `instructions` | string | 0–500 chars. |

---

## 19. Writes for each main event

Each list runs in **one MongoDB transaction** unless marked *(no transaction)*.
"Log" means one `activityLogs` row.

**Admin creates a version**
1. Insert `themeVersions`.
2. Update `themes.latestVersion`.
3. If `notifyRequested`: insert `notificationJobs` (`version_released`, stage `theme_owners`) and set `notificationJobId`.
4. Log `version_released`.

**Admin publishes a theme**
1. Update `themes.status` (and `publishedAt` if it was `null`).
2. If this was the first publish: insert `notificationJobs` (`theme_published`, stage `category_followers`).
3. Log `theme_published`.

**Polar webhook: order paid** (details in `06-payments.md`)
1. Insert `webhookEvents` (`processing`); duplicate already `processed` → stop.
2. Insert `orders` (`method: "card"`); duplicate `provider.orderId` → skip to step 6.
3. Upsert `ownerships` (section 8 rules).
4. `themes.stats.salesCount += 1`; if coupon: `coupons.redemptionsCount += 1`.
5. Log `order_paid`.
6. Set `webhookEvents.status = "processed"`.

**Polar webhook: order refunded**
1. Same `webhookEvents` step.
2. Update `orders.refundedAmount`, `status`, `refundedAt` (section 7).
3. If now `refunded`: revoke the matching ownership (`revokedReason: "refund"`), `themes.stats.salesCount -= 1`, log `order_refunded`.
4. Set `webhookEvents.status = "processed"`.

**Admin approves a wallet payment**
1. Update `walletPayments` → `approved`, `isOpen: false`, `reviewedAt`, `reviewedByUserId`.
2. Insert `orders` (`method: "wallet"`, `currency: "egp"`, amounts = `amountEgp × 100`, `provider.name: "manual_wallet"`).
3. Set `walletPayments.orderId`.
4. Upsert `ownerships`; `themes.stats.salesCount += 1`; coupon `redemptionsCount += 1` if used.
5. Insert `notifications` (`wallet_payment_approved`).
6. Log `wallet_payment_approved`.
7. *(after the transaction, no transaction)* Send the approval email.

**Admin rejects a wallet payment**
1. Update `walletPayments` → `rejected`, `isOpen: false`, `rejectionReason`, `reviewedAt`, `reviewedByUserId`.
2. Insert `notifications` (`wallet_payment_rejected`). Log `wallet_payment_rejected`.
3. *(after)* Send the rejection email.

**Admin marks a wallet order refunded**
1. Update `orders` → `refunded`, `refundedAmount = totalAmount`, `refundedAt`.
2. Revoke the matching ownership (`revokedReason: "refund"`), `themes.stats.salesCount -= 1`.
3. Log `order_refunded`.

**Admin grants / revokes a theme**
1. Upsert or update `ownerships` (section 8). 2. Log `ownership_granted` / `ownership_revoked`.

**Admin disables an account**
1. Update `user.disabled = true`, `disabledReason`, `disabledAt`.
2. Delete the user's `session` documents.
3. Log `account_disabled`.

**Admin sends an announcement**
1. Insert `notificationJobs` (`announcement`). 2. Log `announcement_sent`.

**Customer downloads** *(no transaction)*
1. Check an `active` ownership for (user, theme). 2. Check the rate limit with `downloadLogs`.
3. Insert `downloadLogs`; `themes.stats.downloadCount += 1`. 4. Return a signed URL.
