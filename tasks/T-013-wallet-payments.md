# T-013: Settings and Egyptian wallet payments (manual transfer, admin review)

- Depends on: T-001 – T-012
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2, 5, 6, 7, 9; `docs/03-data-model.md` sections 1, 10, 15, 18, 19 ("Admin approves / rejects a wallet payment");
  `docs/06-payments.md` sections 4, 5.2, 7, 11 ("Wallet"); `docs/07-delivery-updates.md` sections 1, 2.1, 2.2, 2.4, 6;
  `docs/09-emails.md` sections 1.3, 2, 3 (#4, #5, #6), 4; `docs/05-pages.md` sections 4 (`/account/orders`), 5 (wallet payments, settings);
  `docs/10-testing.md` sections 2, 4, 8 (flow 3); `docs/01-decisions.md` D-100 – D-105.
  Pattern to copy: T-012 (checkout, orders, `processPaymentEvent`) and `src/features/themes/*`.

## Goal

1. The one `settings` document (wallet on/off, USD → EGP rate, wallet accounts) and `/admin/settings`.
2. A customer in Egypt can pay by wallet: request → transfer by hand → upload a screenshot → wait.
3. The admin reviews the request and approves it (order + ownership + notification + email) or rejects it (reason).
4. `usdCentsToEgpPounds`, the wallet option on the checkout page, the wallet section of `/account/orders`, emails #4, #5, #6.

**Not in this task**: "Mark as refunded" for wallet orders and the admin order pages (T-018). Customer links on admin
tables are plain text (the customer pages come with T-017).

## Contract: functions of earlier tasks that this task calls

Use these names. If the merged code spells one differently, use the real name and do **not** rename it. Ids are strings.

| Name | File | From |
|---|---|---|
| `activityService.log(input, session?)` — `input: ActivityLogInput` = `{ action, actorRole, actorUserId?, subjectUserId?, targetType?, targetId?, summary }`; omitted nullable fields are `null`; with a `session` every error is thrown; `summary` 2–300 characters | `features/activity/activity.service.ts` | T-005 |
| `createUploadUrl`, `createDownloadUrl`, `headObject` (and the type `PresignedUpload`) | `shared/storage/s3.ts` | T-006 |
| `newWalletProofKey(walletPaymentId, contentType)`, `walletProofPrefix(walletPaymentId)`, `IMAGE_CONTENT_TYPES`, `ImageContentType`, `imageExtension` | `shared/storage/keys.ts` | T-006 |
| `uploadFile(upload, file, onProgress)` (browser) | `shared/storage/upload-file.ts` | T-006 |
| the shared instance `fakeStorage` (class `FakeStorage`) with `putTestObject({ bucket, key, contentType, body })`, `objects`, `uploadUrlRequests`, `downloadUrlRequests` (tests) | `shared/test/fakes/fake-storage.ts` | T-006 |
| `buildWalletPaymentApprovedText({ themeName, amountEgp })` and `buildWalletPaymentRejectedText({ themeName, rejectionReason, walletPaymentId })`, each returns `NotificationText` = `{ title, body, link }` (09 §4). The approved body is `Your payment of <formatPrice(amountEgp * 100, "egp")> was confirmed. You can download the theme now.` (`1,450 EGP`) | `features/notifications/notification.texts.ts` | T-007 |
| `NotificationType`, `NotificationModel`, `NotificationRecord` | `features/notifications/notification.constants.ts`, `notification.model.ts` | T-007 |
| `NotificationModel` (tests read it) | `features/notifications/notification.model.ts` | T-007 |
| `ownershipService.grantFromOrder`, `hasActiveOwnership`, `createOwnership` factory, `OwnershipModel` | `features/ownerships/…` | T-009 |
| `DownloadButton({ versionId, label, size?, variant? })`, `listVersionsForTheme(themeId)` | `features/downloads/components/DownloadButton.tsx`, `features/versions/version.service.ts` | T-009 / T-008 |
| e2e helpers `ADMIN_EMAIL`, `readMongoUri`, `registerAs(page, email)`, `removeAdminAccount`, `markEmailVerified`, `seedPublishedThemeWithZip` | `e2e/helpers.ts` | T-005 / T-012 |
| `couponService.quote`, `recordRedemption`, factory `createCoupon` | `features/coupons/coupon.service.ts` | T-011 |
| `userService.getUserSummary`, `themeService.getThemeForPurchase`, `adjustSalesCount`, `orderService` (T-012), `CheckoutPageData`, `getCheckoutPageData`, `PaymentEventOutcome` | T-012 | |
| `isDuplicateKeyError` | `shared/db/duplicate-key.ts` | T-011 |

## Packages / env

None.

## Amount text

Every EGP amount that is shown or written (pages, emails, notification, activity summaries) is `formatPrice(amountEgp * 100, "egp")` (02 §9.8): it already ends with ` EGP` and has thousands separators, e.g. `1,450 EGP` (T-007's notification text does the same). Below, `<amount>` means this text.
`[PLANNER: 06 §7.4 and 09 §3.1 write "<amountEgp> EGP". Recommended: the formatted text above everywhere, so the notification (T-007), the email, the page and the log agree. Confirm.]`

## Files

```
src/shared/lib/money.ts / money.test.ts                    (change) usdCentsToEgpPounds + tests
src/shared/ui/FileField.tsx                                new UI kit component (below)
src/shared/ui/ProofImage.tsx                               new UI kit component (below)
src/shared/layout/AdminShell.tsx                           (change) optional `badges` prop
src/shared/test/factories.ts                               (change) createWalletPayment, setSettings
e2e/helpers.ts                                             (change) registerAs gets an optional third parameter `country` (default "EG"; the Country select value)
src/app/admin/layout.tsx                                   (change) passes the wallet badge count

src/features/settings/
  settings.model.ts / settings.repository.ts / settings.service.ts / settings.schemas.ts / settings.types.ts / settings.constants.ts / settings.actions.ts
  settings.service.test.ts / settings.schemas.test.ts
  components/admin/WalletSettingsForm.tsx ("use client")

src/features/wallet-payments/
  wallet-payment.model.ts / wallet-payment.repository.ts / wallet-payment.mapper.ts / wallet-payment.schemas.ts / wallet-payment.types.ts / wallet-payment.constants.ts
  wallet-payment.reference.ts                              generateReferenceCode()
  wallet-payment.service.ts                                start, cancel, customer reads
  wallet-payment-proof.service.ts                          createProofUploadUrl, submitWalletProof
  wallet-payment-review.service.ts                         admin list / get / approve / reject
  wallet-payment-email.service.ts                          getWalletPaymentEmailData (no import of email.service: avoids a cycle)
  wallet-payment.actions.ts
  wallet-payment.service.test.ts / wallet-payment-proof.service.test.ts / wallet-payment-review.service.test.ts
  wallet-payment.reference.test.ts / wallet-payment.schemas.test.ts / wallet-payment.mapper.test.ts
  components/WalletInstructions.tsx, WalletProofForm.tsx ("use client"), useWalletProofUpload.ts, WalletCancelButton.tsx ("use client"),
             WalletStartForm.tsx ("use client"), CopyReferenceButton.tsx ("use client"), WalletPaymentView.tsx, WalletPaymentTable.tsx
  components/admin/WalletReviewPanel.tsx ("use client"), components/admin/WalletPaymentAdminTable.tsx

src/features/orders/order-wallet.service.ts / order-wallet.service.test.ts   recordWalletOrder (new file: order.service.ts stays under 250 lines)
src/features/notifications/notification.repository.ts / notification.service.ts / notification.service.test.ts   NEW here (T-007 did not create them): createNotification; T-014 extends the same files
src/features/users/user.repository.ts / user.service.ts / user.service.test.ts   (change) getUserSummaries
src/features/orders/order.repository.ts                    (change) only if a new query is needed
src/features/payments/checkout.service.ts / checkout.types.ts / checkout.service.test.ts   (change) wallet data on the checkout page
src/features/payments/components/PaymentMethodPicker.tsx   new
src/features/emails/templates/WalletApprovedEmail.tsx, WalletRejectedEmail.tsx, AdminWalletReviewEmail.tsx
src/features/emails/email.service.ts / email.service.test.ts    (change)

src/app/checkout/[slug]/page.tsx                           (change) use PaymentMethodPicker
src/app/account/orders/page.tsx                            (change) wallet section
src/app/account/wallet-payments/[id]/page.tsx
src/app/admin/settings/page.tsx
src/app/admin/wallet-payments/page.tsx, [id]/page.tsx
e2e/wallet.spec.ts
```

## Money (`shared/lib/money.ts`) — 06 §7.2

```ts
// USD cents to whole Egyptian pounds, rounded up. Integer math only (D-101).
export function usdCentsToEgpPounds(cents: number, rate: number): number {
  const rateHundredths = Math.round(rate * 100);
  return Math.ceil((cents * rateHundredths) / 10000);
}
```
Tests: `2900, 50.5 → 1465`; `2320, 48 → 1114`; `2900, 50 → 1450`; `100, 48.29 → 49`; `100, 1 → 1`; `2320, 48.29` → `1121` (2320 × 4829 / 10000 = 1120.328 → 1121).

## Settings — 03 §18, 05 §5 `/admin/settings`

`settings.model.ts`: collection `settings`, **`_id` is the string `"global"`** (`_id: { type: String, default: "global" }`, `timestamps: true`), fields of 03 §18 exactly: `walletEnabled` (default `false`), `usdToEgpRate` (default `50`, min 1, max 1000, at most 2 decimals), `walletAccounts` (sub-document `{ label, account, instructions }`, `{ _id: false }`; label 2–40, account 2–100, instructions 0–500 default `""`; at most 5 items; default `[]`). `SettingsRecord` via `InferSchemaType`.
`settings.constants.ts`: `SETTINGS_ID = "global"`, `DEFAULT_USD_TO_EGP_RATE = 50`, `EGP_RATE_MIN = 1`, `EGP_RATE_MAX = 1000`, `MAX_WALLET_ACCOUNTS = 5`, `WALLET_LABEL_MIN = 2`, `WALLET_LABEL_MAX = 40`, `WALLET_ACCOUNT_MIN = 2`, `WALLET_ACCOUNT_MAX = 100`, `WALLET_INSTRUCTIONS_MAX = 500`.

Messages (`SETTINGS_MESSAGES`): `enableNeedsAccount`: `Add at least one wallet account first.` (**exact, 05 §5**). Others — `[PLANNER: not in the docs, confirm]`: `rateRange`: `Enter a rate between 1 and 1000 with up to 2 decimals.`; `labelLength`: `Use 2 to 40 characters.`; `accountLength`: `Use 2 to 100 characters.`; `instructionsLength`: `Use up to 500 characters.`; `tooManyAccounts`: `You can add up to 5 wallet accounts.`; `saved`: `Saved.`

Repository: `findOrCreateSettings()` — `findOneAndUpdate({ _id: "global" }, { $setOnInsert: { walletEnabled: false, usdToEgpRate: 50, walletAccounts: [] } }, { upsert: true, returnDocument: "after" }).lean()`; `saveWalletSettings(fields)` — `findOneAndUpdate({ _id: "global" }, { $set: fields }, { upsert: true, returnDocument: "after", runValidators: true })`.

Service (`settings.service.ts`):

| Function | Rules |
|---|---|
| `getWalletSettings(): Promise<WalletSettingsDTO>` | Creates the document with the defaults when it does not exist. `WalletSettingsDTO = { walletEnabled: boolean; usdToEgpRate: number; walletAccounts: { label: string; account: string; instructions: string }[] }` |
| `updateWalletSettings(input: WalletSettingsInput): Promise<void>` | `walletEnabled` with 0 accounts → `AppError("INVALID", "Add at least one wallet account first.")`; nothing is saved. Otherwise saves the three fields. |

`walletSettingsSchema` (`settings.schemas.ts`): `walletEnabled` boolean; `usdToEgpRate` text → number, 1–1000, at most 2 decimals (`Math.round(value * 100) / 100 === value`), else `rateRange`; `walletAccounts` array of `{ label, account, instructions }` (all trimmed): a row whose three texts are all empty is dropped; at most 5 rows (`tooManyAccounts`); each row `label` 2–40, `account` 2–100, `instructions` 0–500 with the matching message. All row errors are reported under the field key `walletAccounts` (the first message).

Action (`settings.actions.ts`): `saveWalletSettingsAction(_previous, formData): Promise<ActionResult>` — `requireAdmin()`; read `walletEnabled` (`readCheckbox`), `usdToEgpRate` (`readText`), and the rows from `formData.getAll("walletLabel")`, `getAll("walletAccount")`, `getAll("walletInstructions")` zipped by index; schema; `updateWalletSettings` in `try/catch` (`failureFrom`); `revalidatePath("/admin/settings")`, `revalidatePath("/checkout/[slug]", "page")`; return `{ ok: true, data: undefined, message: "Saved." }`. On errors send `values` back: `walletEnabled` (`"on"`/`""`), `usdToEgpRate`, and `rows` = `JSON.stringify` of the typed rows.

Page `/admin/settings` (`requireAdmin()`, metadata `Settings · Theme Store`, `robots: { index: false }`): Heading 1 `Settings`; `Card` with Heading 2 `Wallet payments` and `WalletSettingsForm`.
`WalletSettingsForm` (`"use client"`, `useActionState`, props `settings: WalletSettingsDTO`): `CheckboxField` `Accept Egyptian wallet payments` (name `walletEnabled`), `TextField` `USD → EGP rate` (name `usdToEgpRate`, `inputMode="decimal"`, hint `For example 50.5`), the accounts editor, `SubmitButton` `Save` / `Saving…`, success `Alert`, `FormError`, field errors. The editor keeps its rows in `useState` (initial rows: the typed `rows` JSON after an error — parsed in a `try/catch`, falling back to the saved accounts); per row three `TextField`s `Label` (name `walletLabel`), `Account` (`walletAccount`), and `TextAreaField` `Instructions` (`walletInstructions`, rows 2), and a `Button variant="ghost" size="sm"` `Remove`; below the rows a `Button variant="secondary"` `Add account` that is `disabled` at 5 rows. Rebuild the form with `key={formKey(state)}` like `ThemeForm`.

## Wallet payment model — 03 §10

`wallet-payment.model.ts`: every field and index of 03 §10, collection `walletPayments`; `themeSnapshot` and `proof` sub-documents with `{ _id: false }` (`proof`: `key`, `contentType` enum `image/jpeg | image/png | image/webp`, `sizeBytes` integer 1–5 242 880, all default `null`). **The partial unique index**: `walletPaymentSchema.index({ userId: 1, themeId: 1 }, { unique: true, partialFilterExpression: { isOpen: true } })`. `referenceCode` unique with `match: WALLET_REFERENCE_PATTERN`. `exchangeRate` 1–1000, `amountEgp` integer ≥ 1. Do **not** add a `maxlength` to `themeSnapshot.name` (a test depends on it).
`wallet-payment.constants.ts`:

```ts
export const WALLET_PAYMENT_STATUSES = ["awaiting_payment", "submitted", "approved", "rejected", "cancelled"] as const;
export const WALLET_REFERENCE_PATTERN = /^TS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;
export const REFERENCE_PREFIX = "TS-";  export const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const REFERENCE_LENGTH = 6;      export const MAX_REFERENCE_TRIES = 5;
export const EGYPT_MOBILE_PATTERN = /^01[0125]\d{8}$/;
export const MAX_PROOF_BYTES = 5_242_880;  export const PROOF_UPLOAD_SECONDS = 600;  export const PROOF_VIEW_SECONDS = 300;
export const TRANSACTION_ID_MAX = 100;  export const REJECTION_REASON_MIN = 5;  export const REJECTION_REASON_MAX = 500;
export const WALLET_PAYMENTS_PER_PAGE = 20;
export const WALLET_STATUS_LABELS = { awaiting_payment: "Waiting for payment", submitted: "Waiting for review", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" };
export const WALLET_STATUS_TONES = { awaiting_payment: "neutral", submitted: "warning", approved: "success", rejected: "danger", cancelled: "neutral" };
// Tabs of /admin/wallet-payments (05 §5): key → status and label. "review" is the default.
export const WALLET_TABS = { review: "submitted", approved: "approved", rejected: "rejected", awaiting: "awaiting_payment", cancelled: "cancelled" } as const;
export const WALLET_TAB_LABELS = { review: "Waiting for review", approved: "Approved", rejected: "Rejected", awaiting: "Waiting for payment", cancelled: "Cancelled" };
```

Messages (`WALLET_MESSAGES`) — **exact text from the docs**:

| Key | Text | Where |
|---|---|---|
| `notEgypt` | `Wallet payment is only available for customers in Egypt.` | 06 §7.1 |
| `disabled` | `Wallet payment is not available right now.` | 06 §7.1 |
| `themeUnavailable` | `This theme is not available.` | 06 §7.1 |
| `alreadyOwned` | `You already own this theme.` | 06 §7.1 |
| `proofType` | `Please upload a JPG, PNG or WebP image up to 5 MB.` | 06 §7.5 |
| `phone` | `Please enter the Egyptian mobile number you paid from (11 digits, starts with 01).` | 06 §7.5 |
| `proofMissing` | `We could not find your screenshot. Please upload it again.` | 06 §7.5 |
| `alreadyReviewed` | `This payment was already reviewed.` | 06 §7.6 |

Not in the docs — `[PLANNER: confirm]`: `notFound`: `Payment request not found.` (NOT_FOUND: unknown id, or the request of another user); `notChangeable`: `This payment can no longer be changed.` (CONFLICT: proof upload, submit or cancel when the status is not `awaiting_payment`); `transactionIdLength`: `Use up to 100 characters.`; `reasonLength`: `Write between 5 and 500 characters.`; action results `Payment approved.`, `Payment rejected.`; the unique-reference failure is a plain `Error("Could not generate a unique reference code.")`.

## Reference code (`wallet-payment.reference.ts`) — 06 §7.3

`generateReferenceCode(): string` — `"TS-"` + 6 characters, each `REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]` (`randomInt` from `node:crypto`).

## Wallet payment service (`wallet-payment.service.ts`) — 06 §7.1

| Function | Rules |
|---|---|
| `startWalletPayment({ userId, themeSlug, couponCode }): Promise<{ id: string }>` | The 9 steps of 06 §7.1 in this order: (1) `userService.getUserSummary(userId)` country must be `"EG"` → else `AppError("FORBIDDEN", notEgypt)` (a `null` country is refused too); (2) `settingsService.getWalletSettings().walletEnabled` → else `AppError("INVALID", disabled)`; (3) `themeService.getThemeForPurchase(themeSlug)` exists and is `published` → else `AppError("NOT_FOUND", themeUnavailable)`; (4) no active ownership → else `AppError("CONFLICT", alreadyOwned)`; (5) an **open** request (`isOpen: true`) of this user and theme exists → return `{ id }` of it, create nothing; (6) non-empty `couponCode` → `couponService.quote({ themeId, priceCents, code })` (its `AppError("INVALID", <coupon message>)` passes through); (7) `amountEgp = usdCentsToEgpPounds(finalCents, rate)` with `rate` = the settings' `usdToEgpRate`; (8) insert with `insertWithUniqueReference` (below): `status "awaiting_payment"`, `isOpen true`, `usdPriceCents` = theme price, `usdDiscountCents` = quote discount (0 without coupon), `couponId` / `couponCode` (`null` without coupon), `exchangeRate` = the rate, `amountEgp`, `themeSnapshot { name, slug }`, all other fields `null`; (9) return `{ id }`. A duplicate-key error whose `keyPattern` does **not** contain `referenceCode` (the partial index: a parallel request won) → look the open request up again and return its id. |
| `insertWithUniqueReference(fields, generate = generateReferenceCode): Promise<WalletPaymentRecord>` (exported for tests) | Up to `MAX_REFERENCE_TRIES` (5) tries: `generate()` a code and insert; a duplicate-key error whose `keyPattern` contains `referenceCode` → try again with a new code; any other error is rethrown. After 5 collisions `throw new Error("Could not generate a unique reference code.")`. |
| `cancelWalletPayment({ userId, walletPaymentId }): Promise<void>` | Not found, or of another user → NOT_FOUND `notFound`. Status not `awaiting_payment` → CONFLICT `notChangeable`. Otherwise `status "cancelled"`, `isOpen false` (conditional update on `status: "awaiting_payment"`; 0 modified → CONFLICT `notChangeable`). No log (not in 03 §15). |
| `getWalletPaymentPageData(userId, walletPaymentId): Promise<WalletPaymentPageDTO \| null>` | `null` for an invalid id, unknown id or another user's request. `{ payment: WalletPaymentDTO; accounts: WalletAccountDTO[] }` — `accounts` from the settings, filled only when the status is `awaiting_payment`, otherwise `[]`. |
| `listWalletPaymentsForUser(userId): Promise<WalletPaymentListItemDTO[]>` | The user's requests, newest first (all of them; the docs give the orders page no wallet pagination). |

DTOs (`wallet-payment.types.ts`, built in `wallet-payment.mapper.ts`):
`WalletPaymentDTO = { id, status, themeId, themeName, themeSlug, referenceCode, amountEgp, senderPhone: string | null, transactionId: string | null, submittedAt: Date | null, rejectionReason: string | null }`;
`WalletAccountDTO = { label, account, instructions }`; `WalletPaymentListItemDTO = { id, referenceCode, themeName, amountEgp, status }`;
`WalletPaymentAdminListItemDTO = { id, submittedAt: Date | null, customerName, customerEmail, themeName, amountEgp, referenceCode }`;
`WalletPaymentAdminDTO = { id, status, customer: { id, name, email }, themeName, themeSlug, amountEgp, usdPriceCents, usdDiscountCents, couponCode: string | null, exchangeRate, referenceCode, senderPhone, transactionId, proofUrl: string | null, submittedAt, reviewedAt, rejectionReason }`.

## Proof upload and submit (`wallet-payment-proof.service.ts`) — 06 §7.5, 07 §6

Both functions first load the request (`findWalletPaymentForUser(userId, id)`; invalid id handled): missing / other user → NOT_FOUND `notFound`; `status !== "awaiting_payment"` → CONFLICT `notChangeable`.

| Function | Rules |
|---|---|
| `createProofUploadUrl({ userId, walletPaymentId, contentType, sizeBytes }): Promise<PresignedUpload>` | After the load checks: `contentType` in `IMAGE_CONTENT_TYPES` and `sizeBytes` 1 – 5 242 880, else INVALID `proofType`. `createUploadUrl({ bucket: "private", key: newWalletProofKey(walletPaymentId, contentType), contentType, sizeBytes, cacheControl: null, expiresInSeconds: 600 })`; return its result. |
| `submitWalletProof({ userId, walletPaymentId, senderPhone, transactionId, proofKey }): Promise<void>` | After the load checks, in this order: (1) `senderPhone` matches `EGYPT_MOBILE_PATTERN`, else INVALID `phone`; (2) `transactionId` trimmed, `""` → `null`, longer than 100 → INVALID `transactionIdLength`; (3) `proofKey` starts with `walletProofPrefix(walletPaymentId)`, `headObject({ bucket: "private", key: proofKey })` is not `null`, its `contentType` is allowed and its `sizeBytes` is 1 – 5 242 880 — otherwise INVALID `proofMissing`; (4) one conditional update (`{ _id, userId, status: "awaiting_payment" }`): `status "submitted"`, `senderPhone`, `transactionId`, `proof { key, contentType, sizeBytes }` (from the HEAD result), `submittedAt = now()`; `isOpen` stays `true`; 0 modified → CONFLICT `notChangeable`; (5) `activityService.log({ action: "wallet_payment_submitted", actorRole: "customer", actorUserId: userId, subjectUserId: userId, targetType: "wallet_payment", targetId: walletPaymentId, summary: "Wallet payment submitted: <Theme name> (<amount>)" })` (no transaction); (6) after saving: `try { await sendAdminWalletReviewEmail({ walletPaymentId }) } catch (error) { console.error("sendAdminWalletReviewEmail failed", error) }`. |

## Admin review (`wallet-payment-review.service.ts`) — 06 §7.6, 03 §19

| Function | Rules |
|---|---|
| `listWalletPaymentsForAdmin({ tab, page }): Promise<WalletPaymentAdminPageDTO>` | `tab` is a key of `WALLET_TABS`; the status comes from it. `review`: oldest `submittedAt` first; every other tab: newest `createdAt` first. 20 per page: `{ items, page, totalPages, total }`. Customer name and email through ONE call of `userService.getUserSummaries` (below) for the page. |
| `getWalletPaymentForAdmin(id): Promise<WalletPaymentAdminDTO \| null>` | `null` for an invalid or unknown id. `proofUrl = createDownloadUrl({ key: proof.key, expiresInSeconds: 300, downloadFileName: null })` when there is a proof, else `null` (D-104). |
| `countSubmittedWalletPayments(): Promise<number>` | for the admin menu badge |
| `approveWalletPayment({ walletPaymentId, adminUserId }): Promise<void>` | Unknown id → NOT_FOUND `notFound`. **Transaction** (`withTransaction`), in this order: (1) conditional update `{ _id, status: "submitted" }` → `status "approved"`, `isOpen false`, `reviewedAt = now()`, `reviewedByUserId`; 0 modified → `AppError("CONFLICT", "This payment was already reviewed.")` (rolls back); (2) `orderService.recordWalletOrder(...)` (below) → `orderId`; (3) set `walletPayments.orderId`; (4) inside `recordWalletOrder`: ownership, `salesCount + 1`, coupon redemption; (5) `notificationService.createNotification({ userId, type: "wallet_payment_approved", ...buildWalletPaymentApprovedText({ themeName, amountEgp }) }, session)` — title `Payment approved: <Theme>`, body `Your payment of <amount> was confirmed. You can download the theme now.`, link `/account/themes` (09 §4); (6) `activityService.log({ action: "wallet_payment_approved", actorRole: "admin", actorUserId: adminUserId, subjectUserId: userId, targetType: "wallet_payment", targetId: walletPaymentId, summary: "Wallet payment approved: <Theme name> (<amount>)" }, session)`. **After** the transaction: `try { await sendWalletApprovedEmail({ walletPaymentId }) } catch { console.error(...) }`. The theme may have been unpublished meanwhile: approve anyway. |
| `rejectWalletPayment({ walletPaymentId, reason, adminUserId }): Promise<void>` | `reason` trimmed, 5–500 characters, else INVALID `reasonLength`. Unknown id → NOT_FOUND. **Transaction**: conditional update `{ _id, status: "submitted" }` → `status "rejected"`, `isOpen false`, `rejectionReason`, `reviewedAt`, `reviewedByUserId` (0 modified → CONFLICT `alreadyReviewed`); `createNotification({ userId, type: "wallet_payment_rejected", ...buildWalletPaymentRejectedText({ themeName, rejectionReason, walletPaymentId }) }, session)` — title `Payment not confirmed: <Theme>`, body `Reason: <rejectionReason>`, link `/account/wallet-payments/<id>`; `activityService.log({ action: "wallet_payment_rejected", … summary: "Wallet payment rejected: <Theme name> (<amount>)" }, session)`. After: `sendWalletRejectedEmail({ walletPaymentId })` (failure logged only). |

`orderService.recordWalletOrder` (`order-wallet.service.ts`, T-012's `order.service.ts` is not changed):

```ts
export type WalletOrderInput = { walletPaymentId: string; userId: string; themeId: string; themeName: string; themeSlug: string;
  amountEgp: number; usdPriceCents: number; exchangeRate: number; couponId: string | null; couponCode: string | null; paidAt: Date };
export async function recordWalletOrder(input: WalletOrderInput, session: ClientSession): Promise<{ orderId: string }>
```
Inserts an order: `method "wallet"`, `status "paid"`, `currency "egp"`, `totalAmount = amountEgp * 100`, `subtotalAmount = usdCentsToEgpPounds(usdPriceCents, exchangeRate) * 100`, `discountAmount = Math.max(0, subtotalAmount - totalAmount)`, `taxAmount 0`, `refundedAmount 0`, `couponId`, `couponCode`, `walletPaymentId`, `themeSnapshot { name, slug }`, `provider { name: "manual_wallet", orderId: walletPaymentId, checkoutId: null, customerId: null }`, `paidAt`, `refundedAt null`. Then `ownershipService.grantFromOrder({ userId, themeId, orderId }, session)`, `themeService.adjustSalesCount(themeId, 1, session)`, and when `couponId` is set `couponService.recordRedemption(couponId, session)`. No log (the wallet service logs `wallet_payment_approved`). Returns `{ orderId }`.
`[PLANNER: 03 §19 says order amounts = amountEgp × 100. A coupon is applied to the USD price, and only the final amount is converted. Recommended: totalAmount = amountEgp × 100 and subtotalAmount = the EGP value of the USD price before the coupon (so subtotal − discount = total); alternative: all amounts = amountEgp × 100 with discountAmount 0. Confirm; tests below assume the recommendation. Also confirm paidAt = the approval time.]`
In `approveWalletPayment`, `paidAt = now()` (approval time), amounts and snapshot come from the wallet payment.

## Notification and user helpers added here

- `notification.repository.ts` (new): `insertNotification(fields, session?)` — `NotificationModel.create([fields], { session })`.
- `notification.service.ts` (new): `createNotification(input: { userId: string; type: NotificationType; title: string; body: string; link: string | null }, session?: ClientSession): Promise<void>` — converts `userId` with `toObjectId`, saves `readAt null`, `jobId null`, `createdAt: now()` (clock rule, 10 §2.11). T-014 adds the other notification functions to the same two files.
- `user.service.ts`: `getUserSummaries(userIds: string[]): Promise<UserSummary[]>` — the summaries (T-012's `UserSummary`) of the users that exist; invalid and unknown ids are skipped; one query (`user.repository.ts`: `findUserSummariesByIds`).

## Emails #4, #5, #6 — 09 §3

`wallet-payment-email.service.ts`: `getWalletPaymentEmailData(id): Promise<WalletPaymentEmailData | null>` → `{ id, userName, userEmail, themeName, amountEgp, referenceCode, rejectionReason: string | null, senderPhone: string | null }` (user via `userService.getUserSummary`; `null` when the request or user is missing). It must **not** import `email.service.ts`.
`email.service.ts` gets (each: load data, missing → `AppError("NOT_FOUND", "Payment request not found.")`, render, `getEmailSender().send(...)`):

| Function | To | Subject | Content (09 §3.1), all links `env.APP_URL + path`, no settings line, no `/api/downloads/` |
|---|---|---|---|
| `sendWalletApprovedEmail({ walletPaymentId })` | the buyer | `Payment approved: <Theme> is yours` | `Hi <Name>,` / `We received your payment of **<amount>** (reference <referenceCode>). **<Theme>** is now yours, with free updates for life.` / button `Download your theme` → `/account/themes` |
| `sendWalletRejectedEmail({ walletPaymentId })` | the customer | `We could not confirm your payment for <Theme>` | `Hi <Name>,` / `We could not confirm your wallet payment for **<Theme>** (reference <referenceCode>).` / `Reason: <rejectionReason>` / `If you already sent the money, reply to this email with your transfer details and we will help you.` / button `View payment` → `/account/wallet-payments/<id>` |
| `sendAdminWalletReviewEmail({ walletPaymentId })` | `env.ADMIN_EMAILS[0]` | `New wallet payment to review: <referenceCode>` | `A customer submitted a wallet payment.` / `Customer: <name> (<email>) · Theme: <Theme> · Amount: <amount> · Reference: <referenceCode> · Sender phone: <senderPhone>` / `Check that the money arrived before approving.` / button `Review payment` → `/admin/wallet-payments/<id>` |

Template files `WalletApprovedEmail.tsx`, `WalletRejectedEmail.tsx`, `AdminWalletReviewEmail.tsx` follow `VerifyEmail.tsx` (`EmailLayout`, `EMAIL_PARAGRAPH_STYLE`, `EMAIL_BUTTON_STYLE`). `templateName` = the component name.

## Checkout page: the wallet option

`checkout.types.ts`: `CheckoutPageData.ready` gets `wallet: { amountEgp: number; exchangeRate: number } | null`.
`getCheckoutPageData` (T-012) additionally: `userService.getUserSummary(userId)` country `"EG"` **and** `getWalletSettings().walletEnabled` → `wallet = { amountEgp: usdCentsToEgpPounds(finalPriceCents, usdToEgpRate), exchangeRate: usdToEgpRate }`; otherwise `null`. The T-012 tests of this function check single properties and keep passing unchanged.
`PaymentMethodPicker` (server component, props `slug`, `couponCode`, `wallet`): a `Stack` with a `Card` (Heading 3 `Pay by card`, `CardCheckoutForm` of T-012) and, when `wallet` is not `null`, a second `Card` (Heading 3 `Pay with an Egyptian wallet`, `Text` `You pay <formatPrice(amountEgp * 100, "egp")>.`, `WalletStartForm`). The checkout page renders `PaymentMethodPicker` where T-012 rendered `CardCheckoutForm`.
`WalletStartForm` (`"use client"`, props `slug`, `couponCode`): `useActionState(startWalletPaymentAction, null)`, hidden `slug` and `coupon`, `FormError`, `SubmitButton` `Pay with wallet` / `Starting…`.
`startWalletPaymentAction(_previous, formData)` (`wallet-payment.actions.ts`): `requireVerifiedUser("/checkout/<slug>")`; schema `{ slug, coupon }` (same rules as T-012); `startWalletPayment({ userId: user.id, themeSlug, couponCode })` in `try/catch`; `redirect("/account/wallet-payments/" + id)` outside the `try`.
`[PLANNER: headings and texts of the method picker are not in the docs. Confirm.]`

## Other actions (`wallet-payment.actions.ts`)

| Action | Signature | Rules |
|---|---|---|
| `createProofUploadUrlAction` | `(input: { walletPaymentId: string; contentType: string; sizeBytes: number }): Promise<ActionResult<PresignedUpload>>` | `requireUser`; zod; `createProofUploadUrl({ userId: user.id, ... })`; `{ ok: true, data: upload }`. Called from the browser, not from a form (like 07 §3.1). |
| `submitWalletProofAction` | `(input: { walletPaymentId: string; senderPhone: string; transactionId: string; proofKey: string }): Promise<ActionResult>` | `requireUser`; `submitWalletProofSchema` (phone with message `phone`, transaction id optional ≤ 100, `proofKey` 1–300 chars); `submitWalletProof`; `revalidatePath("/account/wallet-payments/[id]", "page")`, `/account/orders`, `/admin/wallet-payments`; `{ ok: true, data: undefined, message: "Payment details sent." }`. |
| `cancelWalletPaymentAction` | `(_previous, formData): Promise<ActionResult>` | `requireUser`; hidden `id`; `cancelWalletPayment`; revalidate the same paths; `redirect("/account/wallet-payments/" + id)`. |
| `approveWalletPaymentAction` | `(_previous, formData): Promise<ActionResult>` | `requireAdmin`; hidden `id`; `approveWalletPayment({ walletPaymentId, adminUserId: user.id })`; revalidate `/admin/wallet-payments`, `/admin/wallet-payments/[id]`, `/account/wallet-payments/[id]`, `/account/orders`, `/account/themes` (`"page"` for dynamic ones); `{ ok: true, data: undefined, message: "Payment approved." }`. |
| `rejectWalletPaymentAction` | `(_previous, formData): Promise<ActionResult>` | `requireAdmin`; hidden `id`, `reason`; `rejectWalletPaymentSchema` (reason 5–500 with message `reasonLength`); `rejectWalletPayment`; same revalidation; message `Payment rejected.`; `values` `{ reason }` on errors. |

## Pages and components

New UI kit components (no `className` prop, tokens only):
- `FileField.tsx` (`"use client"`): props `label`, `name`, `accept?`, `hint?`, `errors?`, `id?`, `onFileChange?: (file: File | null) => void`. A `<label htmlFor>` + `<input type="file">` styled like the other fields; calls `onFileChange(event.target.files?.[0] ?? null)`.
- `ProofImage.tsx`: props `src`, `alt`. `next/image` with `unoptimized`, `width={1200}`, `height={1200}`, classes `h-auto w-full rounded-md border border-border` (a plain `<img>` would fail `pnpm lint`; the signed URL host is not in `remotePatterns`, hence `unoptimized`).
- `AdminShell.tsx`: new optional prop `badges?: Record<string, number>` (key = menu `href`). A link whose count is greater than 0 shows `<Badge tone="warning">{count}</Badge>` after the label. `app/admin/layout.tsx` calls `countSubmittedWalletPayments()` and passes `{ "/admin/wallet-payments": count }`.

| URL | Behaviour |
|---|---|
| `/account/wallet-payments/[id]` | `requireUser("/account/wallet-payments/<id>")`. `getWalletPaymentPageData(user.id, id)`; `null` → `notFound()`. `PageContainer`, Heading 1 `Wallet payment`, `Badge` with `WALLET_STATUS_LABELS`, then `WalletPaymentView` by status (below). |
| `/account/orders` | T-012's page plus, below the orders table, when `listWalletPaymentsForUser` is not empty: Heading 2 `Wallet payments` and `WalletPaymentTable` with columns `Reference`, `Theme`, `Amount` (`formatPrice(amountEgp * 100, "egp")`), `Status` (`Badge`), and a `TextLink` `View` → `/account/wallet-payments/<id>`. |
| `/admin/wallet-payments?tab=&page=` | `requireAdmin()`. Heading 1 `Wallet payments`; the five tabs as `ButtonLink size="sm"` (active = `primary`, others `secondary`, `?tab=<key>`); `WalletPaymentAdminTable`; `Pagination`. Columns: `Submitted` (`formatDate`, or `—`), `Customer` (name and email as text), `Theme`, `Amount` (EGP), `Reference`, `TextLink` `Review` → `/admin/wallet-payments/<id>`. Empty: `Text` `No payments here.` Query params parsed with a zod schema that falls back to `tab "review"` and `page 1`. |
| `/admin/wallet-payments/[id]` | `requireAdmin()`. `getWalletPaymentForAdmin(id)`, `null` → `notFound()`. Heading 1 `Wallet payment <referenceCode>`, `Badge` status, `WalletReviewPanel`. |
| `/admin/settings` | see Settings |

`WalletPaymentView` (props `payment`, `accounts`, `latestVersionId: string | null`, status decides):

| Status | Shows (texts from 06 §7.4) |
|---|---|
| `awaiting_payment` | `Text size="lg" weight="bold"` = `formatPrice(amountEgp * 100, "egp")`; `Text` `Reference: <referenceCode>` with `CopyReferenceButton`; `WalletInstructions` (one `Card` per account: label bold, account, instructions muted); three `Text` lines `1. Send exactly <amount>.`, `2. Write <referenceCode> in the transfer note.`, `3. Upload the screenshot below.`; `WalletProofForm`; `WalletCancelButton`. |
| `submitted` | `Text` `We received your payment details. We'll review them within 24 hours and notify you.` and the details: `Reference`, `Amount`, `Phone`, `Transaction ID` (when set). |
| `approved` | `Text` `Payment approved. <Theme> is yours.`, `DownloadButton` (`versionId` = `latestVersionId`, `label` `"Download <version>"`; shown when `latestVersionId` is not `null`), `TextLink` `My themes` → `/account/themes`. The page gets `latestVersionId` and the version text from `listVersionsForTheme(themeId)[0]`. |
| `rejected` | `Alert tone="danger"` with the rejection reason, `ButtonLink` `Start a new payment` → `/checkout/<themeSlug>`. |
| `cancelled` | `Text` `This payment was cancelled.` and `TextLink` `Back to <Theme>` → `/themes/<themeSlug>`. |

Client components:
- `CopyReferenceButton` (props `referenceCode`): `Button variant="secondary" size="sm"` `Copy`; `onClick` runs `navigator.clipboard.writeText(referenceCode)` inside `try/catch` and then shows `Copied` (state).
- `WalletCancelButton` (props `walletPaymentId`): `useActionState(cancelWalletPaymentAction, null)`, hidden `id`, `FormError`, `SubmitButton variant="ghost"` `Cancel payment` / `Cancelling…`.
- `useWalletProofUpload.ts` (hook, props `walletPaymentId`): state `status: "idle" | "uploading" | "uploaded" | "failed"`, `progress` (0–100), `errorMessage`, `proofKey`; `start(file)`: (1) client check: type in `IMAGE_CONTENT_TYPES` and size 1 – 5 242 880, else `failed` with `Please upload a JPG, PNG or WebP image up to 5 MB.`; (2) `createProofUploadUrlAction({ walletPaymentId, contentType: file.type, sizeBytes: file.size })`, `!ok` → `failed` with `result.error`; (3) `uploadFile(result.data, file, setProgress)`, a thrown error → `failed` with `The upload failed. Please check your connection and try again.`; (4) `uploaded`, `proofKey = result.data.key`.
- `WalletProofForm` (props `walletPaymentId`): uses the hook; `FileField` `Screenshot of the transfer` (`accept="image/jpeg,image/png,image/webp"`, `onFileChange` → `start`), `Text` `Uploading… <progress>%` while uploading, `Text tone="success"` `Screenshot uploaded.` when uploaded, `Text tone="danger"` with the error; controlled `TextField` `Phone number you paid from` (`type="tel"`) and `TextField` `Transaction ID (optional)`; a `Button type="submit"` `Send payment details` (pending: `Sending…`), `disabled` until `uploaded`. `onSubmit` → `event.preventDefault()`, `startTransition` (React `useTransition`) around `submitWalletProofAction({ walletPaymentId, senderPhone, transactionId, proofKey })`; a failure shows `FormError` (and `fieldErrors` under the phone field); a success calls `router.refresh()`.
- `WalletReviewPanel` (`"use client"`, props `payment: WalletPaymentAdminDTO`): details as `Text` rows (`Customer`, `Theme`, `Amount`, `Reference`, `Phone`, `Transaction ID`, `Submitted`); `ProofImage` with `alt="Transfer screenshot"` when `proofUrl` is set; for status `submitted` only: `Alert tone="warning"` `Check that the money really arrived in your wallet (amount and reference) before you approve.`, an approve form (`useActionState(approveWalletPaymentAction, null)`, hidden `id`, `SubmitButton` `Approve` / `Approving…`) and a reject form (`rejectWalletPaymentAction`, hidden `id`, `TextAreaField` `Reason for the customer` name `reason`, `SubmitButton variant="danger"` `Reject` / `Rejecting…`); each shows `FormError`, and `Alert tone="success"` with the message. Other statuses: `Text` with the status label, the review date and, when rejected, the reason.

`[PLANNER: labels, headings, hints and empty states above are not in the docs, except those quoted from 06 §7.4 / 05 §5. Confirm all others.]`

## Test factories

- `createWalletPayment(overrides?: Partial<Omit<WalletPaymentRecord, "_id">>)`: creates `createUser({ country: "EG" })` when `userId` is missing and a published theme when `themeId` is missing (`themeSnapshot` from that theme). Defaults: `referenceCode: generateReferenceCode()`, `status "awaiting_payment"`, `isOpen` = `true` when the status is `awaiting_payment` or `submitted` (computed from the final status unless given), `usdPriceCents 2900`, `usdDiscountCents 0`, `couponId null`, `couponCode null`, `exchangeRate 50`, `amountEgp 1450`, `senderPhone null`, `transactionId null`, `proof { key: null, contentType: null, sizeBytes: null }`, `submittedAt null`, `reviewedAt null`, `reviewedByUserId null`, `rejectionReason null`, `orderId null`.
- `setSettings(overrides?: Partial<WalletSettingsFields>)`: `findOneAndUpdate({ _id: "global" }, { $set: { walletEnabled: false, usdToEgpRate: 50, walletAccounts: [], ...overrides } }, { upsert: true, returnDocument: "after" })`.

## Required tests

Common set-up: `setTestNow(new Date("2026-11-01T10:00:00Z"))`; a published theme with `priceCents 2900`; a customer `createUser({ country: "EG" })`; `setSettings({ walletEnabled: true, usdToEgpRate: 50, walletAccounts: [{ label: "Vodafone Cash", account: "01012345678", instructions: "" }] })`. For `submitted` requests use `createWalletPayment({ status: "submitted", senderPhone: "01012345678", proof: { key: "wallet-proofs/<id>/abc.png", contentType: "image/png", sizeBytes: 1000 }, submittedAt: <date> })`.

`money.test.ts` (added): the six examples above.

`wallet-payment.reference.test.ts`
- [ ] generateReferenceCode › 500 codes all match `WALLET_REFERENCE_PATTERN` and never contain `0`, `O`, `1`, `I`

`wallet-payment.service.test.ts`
- [ ] startWalletPayment › refuses a customer outside Egypt (`"US"` and `null`) → FORBIDDEN `"Wallet payment is only available for customers in Egypt."`; 0 wallet payments
- [ ] startWalletPayment › refuses when wallet payments are disabled → INVALID `"Wallet payment is not available right now."`; 0 wallet payments
- [ ] startWalletPayment › refuses a draft theme and an unknown slug → NOT_FOUND `"This theme is not available."`
- [ ] startWalletPayment › refuses an owned theme → CONFLICT `"You already own this theme."`; a revoked ownership is allowed
- [ ] startWalletPayment › saves the request: `awaiting_payment`, `isOpen true`, reference code matching the pattern, `usdPriceCents 2900`, `usdDiscountCents 0`, `exchangeRate 50`, `amountEgp 1450`, `themeSnapshot`, all optional fields `null`; returns its id
- [ ] startWalletPayment › rounds the EGP amount up: rate 50.5 → `amountEgp 1465`
- [ ] startWalletPayment › applies a 20 % coupon: rate 48 → `usdDiscountCents 580`, `amountEgp 1114`, `couponId` and `couponCode` saved
- [ ] startWalletPayment › refuses an invalid coupon → INVALID `"This coupon code is not valid."`; 0 wallet payments
- [ ] startWalletPayment › returns the existing open request (awaiting and submitted) instead of creating a second one → same id; 1 row; a different coupon code is ignored
- [ ] startWalletPayment › after a rejected or cancelled request, creates a new one → 2 rows, different ids
- [ ] insertWithUniqueReference › uses a second code after a collision (first generated code already exists) → saved with the second code
- [ ] insertWithUniqueReference › throws `"Could not generate a unique reference code."` after 5 collisions and saves nothing new
- [ ] cancelWalletPayment › cancels an awaiting request (`cancelled`, `isOpen false`); refuses `submitted` and `approved` → CONFLICT `"This payment can no longer be changed."`; another user's request → NOT_FOUND `"Payment request not found."`
- [ ] getWalletPaymentPageData › owner gets the data with the wallet accounts; another user and an invalid id get `null`; accounts are `[]` after submit

`wallet-payment-proof.service.test.ts`
- [ ] createProofUploadUrl › refuses a GIF, 0 bytes and 5 242 881 bytes → INVALID `"Please upload a JPG, PNG or WebP image up to 5 MB."`
- [ ] createProofUploadUrl › returns a key `wallet-proofs/<id>/<16 hex>.png` and the header `Content-Type: image/png` for a PNG
- [ ] createProofUploadUrl › refuses another user's request (NOT_FOUND) and a request that is not `awaiting_payment` (CONFLICT, message above)
- [ ] submitWalletProof › refuses phone numbers `"0212345678"`, `"01312345678"`, `"1012345678"`, `"0101234567"` → INVALID `"Please enter the Egyptian mobile number you paid from (11 digits, starts with 01)."`; status unchanged
- [ ] submitWalletProof › refuses a proof key of another request → INVALID `"We could not find your screenshot. Please upload it again."`; row unchanged
- [ ] submitWalletProof › refuses a missing object, an object of type `image/gif` and an object over 5 MB (`putTestObject`) → the same message
- [ ] submitWalletProof › saves `submitted` with phone, transaction id (`""` → `null`), proof key, content type, size from storage, `submittedAt` now, `isOpen true`; logs `wallet_payment_submitted` (summary `"Wallet payment submitted: <Theme name> (1,450 EGP)"`, actorRole `customer`)
- [ ] submitWalletProof › emails the first admin address once: 1 email to `admin@example.com`, subject `"New wallet payment to review: <reference>"`; an email failure does not change the result
- [ ] submitWalletProof › refuses a second submit → CONFLICT `"This payment can no longer be changed."`; a transaction id of 101 characters → INVALID `"Use up to 100 characters."`

`wallet-payment-review.service.test.ts`
- [ ] approveWalletPayment › creates the order, ownership, notification and log: order `method "wallet"`, `currency "egp"`, `totalAmount 145000`, `subtotalAmount 145000`, `discountAmount 0`, `taxAmount 0`, `provider { name "manual_wallet", orderId = the payment id as text }`, `walletPaymentId` set; payment `approved`, `isOpen false`, `reviewedAt` now, `reviewedByUserId`, `orderId` = the order; active ownership `source "purchase"` with that order; `salesCount 1`; notification `wallet_payment_approved` (userId, title `"Payment approved: <Theme name>"`, body `"Your payment of 1,450 EGP was confirmed. You can download the theme now."`, link `/account/themes`); one `wallet_payment_approved` log (actorRole `admin`); one email to the buyer with subject `"Payment approved: <Theme name> is yours"`
- [ ] approveWalletPayment › with a coupon: price 2900, 20 %, rate 48 → `amountEgp 1114`; order `totalAmount 111400`, `subtotalAmount 139200`, `discountAmount 27800`, `couponCode` saved; coupon `redemptionsCount 1`
- [ ] approveWalletPayment › approving twice → CONFLICT `"This payment was already reviewed."`; still 1 order, `salesCount 1`, 1 notification, 1 email
- [ ] approveWalletPayment › refuses awaiting, rejected and cancelled requests with the same message; nothing written
- [ ] approveWalletPayment › unknown id → NOT_FOUND `"Payment request not found."`
- [ ] approveWalletPayment › keeps an already active ownership unchanged (admin grant) and still saves the order
- [ ] approveWalletPayment › rolls back everything when a write fails: set the snapshot name to 400 characters with `WalletPaymentModel.collection.updateOne({ _id }, { $set: { "themeSnapshot.name": "x".repeat(400) } })` so the log summary exceeds 300 characters → the call throws; payment still `submitted`; 0 orders, 0 ownerships, 0 notifications, `salesCount 0`, 0 emails
- [ ] approveWalletPayment › an email failure after the commit does not undo the approval
- [ ] rejectWalletPayment › saves `rejected`, `isOpen false`, reason, `reviewedAt`, `reviewedByUserId`; notification `wallet_payment_rejected` (title `"Payment not confirmed: <Theme name>"`, body `"Reason: <reason>"`, link `/account/wallet-payments/<id>`); one log; one email with subject `"We could not confirm your payment for <Theme name>"` that contains the reason; no order, no ownership
- [ ] rejectWalletPayment › refuses a reason of 4 and of 501 characters → INVALID `"Write between 5 and 500 characters."`; refuses a request that is not `submitted` → CONFLICT `"This payment was already reviewed."`
- [ ] rejectWalletPayment › the customer can start a new request afterwards (`startWalletPayment` gives a new id)
- [ ] getWalletPaymentForAdmin › returns `proofUrl` containing the proof key (from `fakeStorage`: it contains the key), `null` without a proof; `null` for an unknown id
- [ ] listWalletPaymentsForAdmin › the `review` tab shows only `submitted`, oldest `submittedAt` first; other tabs show their status; 25 rows → 20 + 5
- [ ] countSubmittedWalletPayments › counts only `submitted`

`order-wallet.service.test.ts`: covered through the approve tests; add one test: `recordWalletOrder` › inserts the order with the amounts above and grants the ownership (inside `withTransaction`).

`settings.service.test.ts` / `settings.schemas.test.ts`
- [ ] getWalletSettings › creates the defaults on first use (`walletEnabled false`, rate 50, no accounts) and keeps exactly one document with `_id "global"`
- [ ] updateWalletSettings › saves the three fields
- [ ] updateWalletSettings › refuses enabling with 0 accounts → INVALID `"Add at least one wallet account first."`; document unchanged; disabling with 0 accounts and enabling with 1 account work
- [ ] walletSettingsSchema › accepts `"50.5"`; refuses `"0.5"`, `"1000.01"`, `"12.345"`, `"abc"` with `"Enter a rate between 1 and 1000 with up to 2 decimals."`
- [ ] walletSettingsSchema › refuses 6 accounts; drops an all-empty row; refuses a label of 1 character

`notification.service.test.ts` / `user.service.test.ts` (added)
- [ ] createNotification › saves the notification with `readAt null`, `jobId null`, `createdAt` = now; inside `withTransaction` that throws, nothing is saved
- [ ] getUserSummaries › returns `id`, `name`, `email`, `country` for known ids and skips unknown and invalid ids (2 users + a new ObjectId + `"x"` give 2 items)

`wallet-payment.schemas.test.ts` / `wallet-payment.mapper.test.ts`
- [ ] submitWalletProofSchema › accepts `"01012345678"`, refuses `"01312345678"` with the phone message; empty transaction id is accepted
- [ ] rejectWalletPaymentSchema › refuses 4 characters
- [ ] toWalletPaymentDTO › maps the snapshot, amounts and nullable fields

`checkout.service.test.ts` (added)
- [ ] getCheckoutPageData › `wallet` is `{ amountEgp: 1114, exchangeRate: 48 }` for an Egyptian user, wallet enabled, 20 % coupon, rate 48; `null` for a user from another country; `null` when wallet payments are disabled

`email.service.test.ts` (added)
- [ ] sendWalletApprovedEmail › subject, `1,450 EGP`, the reference, link `http://localhost:3000/account/themes`; no settings link; no `/api/downloads/`
- [ ] sendWalletRejectedEmail › subject, the reason, link `http://localhost:3000/account/wallet-payments/<id>`
- [ ] sendAdminWalletReviewEmail › goes to `admin@example.com`; contains customer name and email, amount, reference, sender phone and the link `http://localhost:3000/admin/wallet-payments/<id>`

## E2E (`e2e/wallet.spec.ts`, flow 3 of `10-testing.md` §8; helpers from `e2e/helpers.ts`)

`beforeAll`: connect mongoose; `removeAdminAccount()`; `seedPublishedThemeWithZip` (T-012); `SettingsModel.findOneAndUpdate({ _id: "global" }, { $set: { walletEnabled: true, usdToEgpRate: 50, walletAccounts: [{ label: "Vodafone Cash", account: "01012345678", instructions: "" }] } }, { upsert: true })`. `afterAll`: delete the seeded theme, wallet payments, orders, ownerships and the settings document.
- [ ] an Egyptian customer pays by wallet and the admin approves: customer `registerAs` (country EG) + `markEmailVerified`; open `/checkout/<slug>` → text `1,450 EGP` and button `Pay with wallet`; click → URL `/account/wallet-payments/<id>`; text `Vodafone Cash`, `01012345678` and a reference matching `TS-[A-Z0-9]{6}`; `getByLabel("Screenshot of the transfer").setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: <a small PNG buffer> })` → `Screenshot uploaded.`; fill `Phone number you paid from` with `01012345678`; click `Send payment details` → `We received your payment details. We'll review them within 24 hours and notify you.`. In a **second browser context** the admin (`registerAs(adminPage, ADMIN_EMAIL)`) opens `/admin/wallet-payments` → the row with the reference → `Review` → the page shows the screenshot (`getByAltText("Transfer screenshot")`) and the reminder → click `Approve` → `Payment approved.`. The customer reloads the payment page → `Payment approved. <name> is yours.`; the link starting with `Download` downloads `<slug>-1.0.0.zip` with the seeded bytes. DB: 1 order `egp` with `totalAmount 145000`, 1 active ownership
- [ ] the admin rejects a request: the customer starts a new request, uploads and submits; the admin clicks `Reject` with reason `Money not received yet` → the customer's payment page shows that reason and a `Start a new payment` link
- [ ] `/admin/settings`: enabling `Accept Egyptian wallet payments` with no accounts → `Add at least one wallet account first.`; after `Add account`, filling `Label`, `Account` and saving → `Saved.`
- [ ] a customer from another country (register with `US`) opens the checkout → no `Pay with wallet` button

Break check (≥ 3): remove the country check in `startWalletPayment`; remove the `status: "submitted"` filter of the approve update; make `usdCentsToEgpPounds` use `Math.round`; skip the `proofKey` prefix check; move the notification insert outside `withTransaction`.

## Do NOT

- Do not add fields, indexes or statuses that are not in 03 §10 / §18. Do not store the screenshot anywhere except the **private** bucket under `wallet-proofs/<id>/`, and never put its signed URL in an email or a log (D-104).
- Do not send emails, read storage or call the provider inside a transaction. Do not trust the amount or theme from the browser: the server computes `amountEgp`.
- Do not build "Mark as refunded" or admin order pages (T-018). No wallet API integration (D-100).
- Feature components and pages: layout classes only. No `any`, no `@ts-ignore`, no `eslint-disable`.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-013: settings and wallet payments`
