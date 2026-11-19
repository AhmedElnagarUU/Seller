import { Types } from "mongoose";
import { ActivityLogModel, type ActivityLogRecord } from "@/features/activity/activity-log.model";
import { CategoryModel, type CategoryRecord } from "@/features/categories/category.model";
import { CouponModel, type CouponRecord } from "@/features/coupons/coupon.model";
import { OrderModel, type OrderRecord } from "@/features/orders/order.model";
import { OwnershipModel, type OwnershipRecord } from "@/features/ownerships/ownership.model";
import { SettingsModel } from "@/features/settings/settings.model";
import type { WalletSettingsDTO } from "@/features/settings/settings.types";
import { ThemeModel, type ThemeRecord } from "@/features/themes/theme.model";
import { UserModel, type UserRecord } from "@/features/users/user.model";
import type { ChangeType } from "@/features/versions/version.constants";
import { VersionModel, type VersionRecord } from "@/features/versions/version.model";
import { generateReferenceCode } from "@/features/wallet-payments/wallet-payment.reference";
import { WalletPaymentModel, type WalletPaymentRecord } from "@/features/wallet-payments/wallet-payment.model";
import { now } from "@/shared/lib/clock";

// Test data with valid defaults. Every factory takes overrides for the fields a test cares about.
// createUser writes to the `user` collection directly: this is allowed only in test factories.

let counter = 0;

function nextNumber(): number {
  counter += 1;
  return counter;
}

export async function createUser(overrides: Partial<Omit<UserRecord, "_id">> = {}): Promise<UserRecord> {
  const number = nextNumber();
  const user = await UserModel.create({
    name: `Customer ${number}`,
    email: `customer-${number}@example.com`,
    emailVerified: true,
    ...overrides,
  });
  return user.toObject();
}

// The admin of the tests: "admin@example.com" is in the ADMIN_EMAILS of vitest.config.ts.
export async function createAdmin(): Promise<UserRecord> {
  return createUser({ name: "Admin", email: "admin@example.com" });
}

export async function createCategory(overrides: Partial<Omit<CategoryRecord, "_id">> = {}): Promise<CategoryRecord> {
  const number = nextNumber();
  const category = await CategoryModel.create({
    name: `Category ${number}`,
    slug: `category-${number}`,
    description: null,
    sortOrder: 0,
    ...overrides,
  });
  return category.toObject();
}

// An active percent coupon for all themes, never used, not synced. Override any field.
export async function createCoupon(overrides: Partial<Omit<CouponRecord, "_id">> = {}): Promise<CouponRecord> {
  const number = nextNumber();
  const coupon = new CouponModel();
  coupon.set({
    code: `COUPON-${number}`,
    type: "percent",
    percentOff: 20,
    amountOffCents: null,
    appliesTo: "all",
    themeIds: [],
    expiresAt: null,
    maxRedemptions: null,
    redemptionsCount: 0,
    active: true,
    provider: { discountId: null, syncedAt: null },
    ...overrides,
  });
  await coupon.save();
  return coupon.toObject();
}

type ThemeImageInput = { key: string; alt: string; width: number; height: number };
type ThemeOverrides = Partial<Omit<ThemeRecord, "_id" | "images">> & { images?: ThemeImageInput[] };

// A draft theme in a new category. Pass `categoryId` to use an existing category.
// With status "published", publishedAt is set to now() unless you pass it.
export async function createTheme(overrides: ThemeOverrides = {}): Promise<ThemeRecord> {
  const number = nextNumber();
  const categoryId = overrides.categoryId ?? (await createCategory())._id;
  const status = overrides.status ?? "draft";
  const theme = await ThemeModel.create({
    name: `Theme ${number}`,
    slug: `theme-${number}`,
    tagline: `A fast and clean theme number ${number}`,
    description: "A longer description of this theme. It has more than fifty characters in it.",
    features: [],
    priceCents: 2900,
    demoUrl: null,
    requirements: { wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" },
    featured: false,
    publishedAt: status === "published" ? now() : null,
    ...overrides,
    status,
    categoryId,
  });
  return theme.toObject();
}

// A system "order_paid" row about nobody. Pass `createdAt` to place it in time.
export async function createActivityLog(
  overrides: Partial<Omit<ActivityLogRecord, "_id">> = {},
): Promise<ActivityLogRecord> {
  const number = nextNumber();
  const activityLog = await ActivityLogModel.create({
    action: "order_paid",
    actorRole: "system",
    actorUserId: null,
    subjectUserId: null,
    targetType: null,
    targetId: null,
    summary: `Order paid: Theme ${number}`,
    ...overrides,
  });
  return activityLog.toObject();
}

type VersionOverrides = Partial<Omit<VersionRecord, "_id" | "themeId" | "changes">> & {
  changes?: { type: ChangeType; text: string }[];
};

// One version row of a theme. It does NOT touch the theme (`latestVersion` stays as it is).
export async function createVersion(themeId: string, overrides: VersionOverrides = {}): Promise<VersionRecord> {
  const number = nextNumber();
  const version = await VersionModel.create({
    version: "1.0.0",
    changes: [{ type: "new", text: "First release" }],
    file: {
      key: `theme-zips/${themeId}/${String(number).padStart(16, "0")}.zip`,
      sizeBytes: 1000,
      sha256: "a".repeat(64),
      originalName: "theme.zip",
    },
    releasedAt: now(),
    notifyRequested: false,
    notificationJobId: null,
    ...overrides,
    themeId: new Types.ObjectId(themeId),
  });
  return version.toObject();
}

type OwnershipOverrides = Partial<Omit<OwnershipRecord, "_id" | "userId" | "themeId">>;

// An active admin grant of a theme to a user. For a revoked one pass `status`, `revokedAt`, `revokedReason`
// and the fields they require.
export async function createOwnership(
  userId: string,
  themeId: string,
  overrides: OwnershipOverrides = {},
): Promise<OwnershipRecord> {
  const ownership = await OwnershipModel.create({
    status: "active",
    source: "admin_grant",
    orderId: null,
    grantedByUserId: new Types.ObjectId(),
    grantNote: null,
    licenseType: "standard",
    revokedAt: null,
    revokedReason: null,
    revokedByUserId: null,
    revokeNote: null,
    ...overrides,
    userId: new Types.ObjectId(userId),
    themeId: new Types.ObjectId(themeId),
  });
  return ownership.toObject();
}

type OrderOverrides = Partial<Omit<OrderRecord, "_id">>;

// A paid card order of $29.00 for a published theme. Creates the user and the theme when `userId` / `themeId` are missing.
// It does not create an ownership and does not change `salesCount`.
export async function createOrder(overrides: OrderOverrides = {}): Promise<OrderRecord> {
  const number = nextNumber();
  const userId = overrides.userId ?? (await createUser())._id;
  const theme = overrides.themeId
    ? await ThemeModel.findById(overrides.themeId).lean<ThemeRecord>()
    : await createTheme({ status: "published" });
  const themeId = overrides.themeId ?? theme?._id;
  const order = new OrderModel();
  order.set({
    userId,
    themeId,
    themeSnapshot: { name: theme?.name ?? `Theme ${number}`, slug: theme?.slug ?? `theme-${number}` },
    method: "card",
    status: "paid",
    currency: "usd",
    subtotalAmount: 2900,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 2900,
    refundedAmount: 0,
    couponId: null,
    couponCode: null,
    walletPaymentId: null,
    provider: { name: "polar", orderId: `order_${number}`, checkoutId: null, customerId: null },
    paidAt: now(),
    refundedAt: null,
    ...overrides,
  });
  await order.save();
  return order.toObject();
}

type WalletPaymentOverrides = Partial<Omit<WalletPaymentRecord, "_id">>;

// A wallet payment request of 1,450 EGP (2900 cents at rate 50) that waits for payment. Creates an Egyptian user
// and a published theme when `userId` / `themeId` are missing. `isOpen` follows the status unless you pass it.
export async function createWalletPayment(overrides: WalletPaymentOverrides = {}): Promise<WalletPaymentRecord> {
  const userId = overrides.userId ?? (await createUser({ country: "EG" }))._id;
  const theme = overrides.themeId
    ? await ThemeModel.findById(overrides.themeId).lean<ThemeRecord>()
    : await createTheme({ status: "published" });
  const status = overrides.status ?? "awaiting_payment";
  const payment = new WalletPaymentModel();
  payment.set({
    userId,
    themeId: overrides.themeId ?? theme?._id,
    themeSnapshot: { name: theme?.name ?? "Theme", slug: theme?.slug ?? "theme" },
    referenceCode: generateReferenceCode(),
    status,
    isOpen: status === "awaiting_payment" || status === "submitted",
    usdPriceCents: 2900,
    usdDiscountCents: 0,
    couponId: null,
    couponCode: null,
    exchangeRate: 50,
    amountEgp: 1450,
    senderPhone: null,
    transactionId: null,
    proof: { key: null, contentType: null, sizeBytes: null },
    submittedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    rejectionReason: null,
    orderId: null,
    ...overrides,
  });
  await payment.save();
  return payment.toObject();
}

// Replaces the wallet part of the one settings document. Without overrides: wallet off, rate 50, no accounts.
export async function setSettings(overrides: Partial<WalletSettingsDTO> = {}): Promise<void> {
  await SettingsModel.findOneAndUpdate(
    { _id: "global" },
    { $set: { walletEnabled: false, usdToEgpRate: 50, walletAccounts: [], ...overrides } },
    { upsert: true, returnDocument: "after" },
  );
}
