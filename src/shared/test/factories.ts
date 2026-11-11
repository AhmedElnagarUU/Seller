import { ActivityLogModel, type ActivityLogRecord } from "@/features/activity/activity-log.model";
import { CategoryModel, type CategoryRecord } from "@/features/categories/category.model";
import { ThemeModel, type ThemeRecord } from "@/features/themes/theme.model";
import { UserModel, type UserRecord } from "@/features/users/user.model";
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
