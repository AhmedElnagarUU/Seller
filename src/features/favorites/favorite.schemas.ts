import { z } from "zod";
import { FAVORITE_ID_PATTERN } from "@/features/favorites/favorite.constants";

export const favoriteTargetSchema = z.object({
  targetId: z.string().trim().regex(FAVORITE_ID_PATTERN, "Not found."),
});

export type FavoriteTargetInput = z.infer<typeof favoriteTargetSchema>;
