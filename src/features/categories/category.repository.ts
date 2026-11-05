import { connectDB } from "@/shared/db/connect";
import { parseObjectId, toObjectId } from "@/shared/db/ids";
import { escapeRegex } from "@/shared/lib/regex";
import { CategoryModel, type CategoryRecord } from "@/features/categories/category.model";

const MONGO_DUPLICATE_KEY_CODE = 11000;

// The fields an admin can write.
export type CategoryFields = Pick<CategoryRecord, "name" | "slug" | "description" | "sortOrder">;

// True when MongoDB refused a write because of a unique index.
export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === MONGO_DUPLICATE_KEY_CODE;
}

// Finds a category by id, or null (also when the id is not a valid id).
export async function findCategoryById(id: string): Promise<CategoryRecord | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  await connectDB();
  return CategoryModel.findById(objectId).lean<CategoryRecord>();
}

// Finds a category by slug, or null.
export async function findCategoryBySlug(slug: string): Promise<CategoryRecord | null> {
  await connectDB();
  return CategoryModel.findOne({ slug }).lean<CategoryRecord>();
}

// Lists all categories: lower sortOrder first, then by name.
export async function listCategories(): Promise<CategoryRecord[]> {
  await connectDB();
  return CategoryModel.find().sort({ sortOrder: 1, name: 1 }).collation({ locale: "en" }).lean<CategoryRecord[]>();
}

// True when another category has this name, ignoring case. `ownId` is left out of the check.
export async function existsCategoryByNameInsensitive(name: string, ownId?: string): Promise<boolean> {
  await connectDB();
  const sameName = new RegExp(`^${escapeRegex(name)}$`, "i");
  const filter = ownId ? { name: sameName, _id: { $ne: toObjectId(ownId) } } : { name: sameName };
  return (await CategoryModel.exists(filter)) !== null;
}

// Inserts a category.
export async function insertCategory(fields: CategoryFields): Promise<CategoryRecord> {
  await connectDB();
  const created = await CategoryModel.create(fields);
  return created.toObject();
}

// Replaces the editable fields of a category. Returns null when it does not exist.
export async function updateCategoryById(id: string, fields: CategoryFields): Promise<CategoryRecord | null> {
  await connectDB();
  return CategoryModel.findByIdAndUpdate(
    toObjectId(id),
    { $set: fields },
    { returnDocument: "after", runValidators: true },
  ).lean<CategoryRecord>();
}

// Deletes a category.
export async function deleteCategoryById(id: string): Promise<void> {
  await connectDB();
  await CategoryModel.deleteOne({ _id: toObjectId(id) });
}
