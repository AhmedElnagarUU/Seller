import type { SortOrder } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { parseObjectId, toObjectId } from "@/shared/db/ids";
import { escapeRegex } from "@/shared/lib/regex";
import type { ThemeSort, ThemeStatus } from "@/features/themes/theme.constants";
import { ThemeModel, type ThemeRecord } from "@/features/themes/theme.model";

const MONGO_DUPLICATE_KEY_CODE = 11000;

// The fields an admin can write. Status, images, versions, stats and provider are never part of it.
export type ThemeFields = Pick<
  ThemeRecord,
  "name" | "slug" | "tagline" | "description" | "features" | "priceCents" | "demoUrl" | "requirements" | "featured"
> & { categoryId: string };

// What to look for. Every field is optional; the ones given are combined with AND.
export type ThemeQuery = {
  status?: ThemeStatus;
  categoryId?: string;
  isFeatured?: boolean;
  nameContains?: string;
  nameOrTaglineContains?: string;
};

// How to order a list. "recently-created" is for the admin list.
export type ThemeListSort = ThemeSort | "recently-created";

type MongoFilter = Record<string, unknown>;

const SORTS: Record<ThemeListSort, Record<string, SortOrder>> = {
  newest: { publishedAt: -1, _id: -1 },
  best: { "stats.salesCount": -1, publishedAt: -1, _id: -1 },
  "price-asc": { priceCents: 1, publishedAt: -1, _id: -1 },
  "price-desc": { priceCents: -1, publishedAt: -1, _id: -1 },
  "recently-created": { createdAt: -1, _id: -1 },
};

// True when MongoDB refused a write because of a unique index.
export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === MONGO_DUPLICATE_KEY_CODE;
}

// Case-insensitive "contains" match. The text is escaped so it is searched as plain text.
function containsText(text: string): RegExp {
  return new RegExp(escapeRegex(text), "i");
}

function buildFilter(query: ThemeQuery): MongoFilter {
  const filter: MongoFilter = {};
  if (query.status) filter.status = query.status;
  if (query.categoryId) filter.categoryId = toObjectId(query.categoryId);
  if (query.isFeatured !== undefined) filter.featured = query.isFeatured;
  if (query.nameContains) filter.name = containsText(query.nameContains);
  if (query.nameOrTaglineContains) {
    const pattern = containsText(query.nameOrTaglineContains);
    filter.$or = [{ name: pattern }, { tagline: pattern }];
  }
  return filter;
}

// Finds a theme by id, any status, or null (also when the id is not a valid id).
export async function findThemeById(id: string): Promise<ThemeRecord | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  await connectDB();
  return ThemeModel.findById(objectId).lean<ThemeRecord>();
}

// Finds a theme by slug, any status, or null.
export async function findThemeBySlug(slug: string): Promise<ThemeRecord | null> {
  await connectDB();
  return ThemeModel.findOne({ slug }).lean<ThemeRecord>();
}

// Finds one page of themes. Pages are numbered from 1.
export async function findThemes(
  query: ThemeQuery,
  sort: ThemeListSort,
  page: number,
  pageSize: number,
): Promise<ThemeRecord[]> {
  await connectDB();
  return ThemeModel.find(buildFilter(query))
    .sort(SORTS[sort])
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean<ThemeRecord[]>();
}

// Counts the themes that match.
export async function countThemes(query: ThemeQuery): Promise<number> {
  await connectDB();
  return ThemeModel.countDocuments(buildFilter(query));
}

// Inserts a new draft theme.
export async function insertTheme(fields: ThemeFields): Promise<ThemeRecord> {
  await connectDB();
  const created = await ThemeModel.create({ ...fields, categoryId: toObjectId(fields.categoryId), status: "draft" });
  return created.toObject();
}

// Replaces the editable fields of a theme. Returns null when it does not exist.
export async function updateThemeById(id: string, fields: ThemeFields): Promise<ThemeRecord | null> {
  await connectDB();
  return ThemeModel.findByIdAndUpdate(
    toObjectId(id),
    { $set: { ...fields, categoryId: toObjectId(fields.categoryId) } },
    { returnDocument: "after", runValidators: true },
  ).lean<ThemeRecord>();
}
