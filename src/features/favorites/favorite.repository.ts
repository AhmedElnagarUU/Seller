import type { Types } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { parseObjectId } from "@/shared/db/ids";
import type { FavoriteTargetType } from "@/features/favorites/favorite.constants";
import { FavoriteModel } from "@/features/favorites/favorite.model";

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
