// What a customer can favorite: a theme, or a category to follow (docs/03-data-model.md section 11).
export const FAVORITE_TARGET_TYPES = ["theme", "category"] as const;
export type FavoriteTargetType = (typeof FAVORITE_TARGET_TYPES)[number];

export const FAVORITE_ID_PATTERN = /^[a-f0-9]{24}$/i; // an ObjectId written as text

export const FAVORITE_LABELS = {
  favorite: "♥ Favorite", // docs/00 3.1, docs/05 §3
  unfavorite: "Remove from favorites", // owner decision 15-B
  follow: "Follow category", // docs/00 3.1
  unfollow: "Unfollow category", // owner decision 15-B
  removeFromList: "Remove", // docs/05 §4, button on each favorite theme card
  unfollowFromList: "Unfollow", // docs/05 §4, button on each followed category
} as const;
