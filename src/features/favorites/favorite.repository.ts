import type { Types } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { isDuplicateKeyError } from "@/shared/db/duplicate-key";
import { parseObjectId, toObjectId } from "@/shared/db/ids";
import type { FavoriteTargetType } from "@/features/favorites/favorite.constants";
import { FavoriteModel, type FavoriteRecord } from "@/features/favorites/favorite.model";

type FavoriteRowsInput = {
  targetType: FavoriteTargetType;
  targetId: string;
  afterId: string | null;
  limit: number;
};

// The next rows of the favorites of one target, `_id` ascending, after `afterId` (all rows when null).
// An invalid target id gives no rows.
export async function findFavoriteRowsAfter(
  input: FavoriteRowsInput,
): Promise<{ _id: Types.ObjectId; userId: Types.ObjectId }[]> {
  const targetObjectId = parseObjectId(input.targetId);
  if (!targetObjectId) return [];
  const afterObjectId = input.afterId === null ? null : parseObjectId(input.afterId);
  if (input.afterId !== null && !afterObjectId) return [];
  await connectDB();
  const filter = {
    targetType: input.targetType,
    targetId: targetObjectId,
    ...(afterObjectId ? { _id: { $gt: afterObjectId } } : {}),
  };
  return FavoriteModel.find(filter)
    .sort({ _id: 1 })
    .limit(input.limit)
    .select({ userId: 1 })
    .lean<{ _id: Types.ObjectId; userId: Types.ObjectId }[]>();
}

// Saves a favorite once. A second save of the same row (or two clicks at the same time) changes nothing.
export async function insertFavoriteIfMissing(
  userId: string,
  targetType: FavoriteTargetType,
  targetId: string,
): Promise<void> {
  const row = { userId: toObjectId(userId), targetType, targetId: toObjectId(targetId) };
  await connectDB();
  try {
    await FavoriteModel.updateOne(row, { $setOnInsert: row }, { upsert: true });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
}

// Removes one favorite. A missing row is not an error.
export async function deleteFavorite(userId: string, targetType: FavoriteTargetType, targetId: string): Promise<void> {
  await connectDB();
  await FavoriteModel.deleteOne({ userId: toObjectId(userId), targetType, targetId: toObjectId(targetId) });
}

// Removes every favorite of one target (used when a category is deleted).
export async function deleteFavoritesByTarget(targetType: FavoriteTargetType, targetId: string): Promise<void> {
  await connectDB();
  await FavoriteModel.deleteMany({ targetType, targetId: toObjectId(targetId) });
}

// The favorites of one customer of one type, most recently added first.
export async function listFavoritesByUser(userId: string, targetType: FavoriteTargetType): Promise<FavoriteRecord[]> {
  await connectDB();
  return FavoriteModel.find({ userId: toObjectId(userId), targetType })
    .sort({ _id: -1 })
    .lean<FavoriteRecord[]>();
}

// True when this customer has this favorite.
export async function existsFavorite(
  userId: string,
  targetType: FavoriteTargetType,
  targetId: string,
): Promise<boolean> {
  await connectDB();
  const found = await FavoriteModel.exists({
    userId: toObjectId(userId),
    targetType,
    targetId: toObjectId(targetId),
  });
  return found !== null;
}
