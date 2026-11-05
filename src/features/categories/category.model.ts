import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import {
  CATEGORY_DESCRIPTION_MAX,
  CATEGORY_NAME_MAX,
  CATEGORY_NAME_MIN,
  CATEGORY_SLUG_PATTERN,
  CATEGORY_SORT_ORDER_MAX,
  CATEGORY_SORT_ORDER_MIN,
} from "@/features/categories/category.constants";

const categorySchema = new Schema(
  {
    // Display name, e.g. "Blog". Unique ignoring case (checked in the service).
    name: { type: String, required: true, trim: true, minlength: CATEGORY_NAME_MIN, maxlength: CATEGORY_NAME_MAX },
    // URL part, e.g. "blog". Unique.
    slug: { type: String, required: true, trim: true, match: CATEGORY_SLUG_PATTERN },
    // Shown on the category page.
    description: { type: String, default: null, trim: true, maxlength: CATEGORY_DESCRIPTION_MAX },
    // Lower numbers show first.
    sortOrder: {
      type: Number,
      required: true,
      default: 0,
      min: CATEGORY_SORT_ORDER_MIN,
      max: CATEGORY_SORT_ORDER_MAX,
      validate: Number.isInteger,
    },
  },
  { collection: "categories", timestamps: true },
);

categorySchema.index({ slug: 1 }, { unique: true });

export type CategoryRecord = InferSchemaType<typeof categorySchema> & { _id: Types.ObjectId };

// `models.Category ||` stops hot reload from defining the model twice.
export const CategoryModel =
  (models.Category as Model<CategoryRecord>) || model<CategoryRecord>("Category", categorySchema);
