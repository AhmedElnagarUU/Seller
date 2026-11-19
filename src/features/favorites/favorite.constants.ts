// What a customer can favorite: a theme, or a category to follow (docs/03-data-model.md section 11).
export const FAVORITE_TARGET_TYPES = ["theme", "category"] as const;
export type FavoriteTargetType = (typeof FAVORITE_TARGET_TYPES)[number];
