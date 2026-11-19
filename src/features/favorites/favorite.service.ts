import type { FavoriteTargetType } from "@/features/favorites/favorite.constants";
import * as favoriteRepository from "@/features/favorites/favorite.repository";

type ListFavoriteRowsInput = {
  targetType: FavoriteTargetType;
  targetId: string;
  afterId: string | null;
  limit: number;
};

// The next favorite rows of a theme or category after `afterId` (all when null), `_id` ascending.
// `rowId` is the favorite's `_id`: the cursor of a notification job.
export async function listFavoriteRowsAfter(
  input: ListFavoriteRowsInput,
): Promise<{ rowId: string; userId: string }[]> {
  const rows = await favoriteRepository.findFavoriteRowsAfter(input);
  return rows.map((row) => ({ rowId: row._id.toString(), userId: row.userId.toString() }));
}
