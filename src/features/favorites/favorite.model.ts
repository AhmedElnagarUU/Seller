import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { FAVORITE_TARGET_TYPES } from "@/features/favorites/favorite.constants";

// A favorited theme or a followed category (docs/03-data-model.md section 11, D-110).
const favoriteSchema = new Schema(
  {
    // The customer who favorited or follows.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // What is favorited: a theme or a category.
    targetType: { type: String, required: true, enum: FAVORITE_TARGET_TYPES },
    // A theme id or category id, depending on `targetType`.
    targetId: { type: Schema.Types.ObjectId, required: true },
  },
  { collection: "favorites", timestamps: true },
);

// A customer favorites a target only once.
favoriteSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
// Notification fan-out.
favoriteSchema.index({ targetType: 1, targetId: 1, _id: 1 });

export type FavoriteRecord = InferSchemaType<typeof favoriteSchema> & { _id: Types.ObjectId };

// `models.Favorite ||` stops hot reload from defining the model twice.
export const FavoriteModel =
  (models.Favorite as Model<FavoriteRecord>) || model<FavoriteRecord>("Favorite", favoriteSchema);
