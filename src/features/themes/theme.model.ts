import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import {
  DEMO_URL_MAX,
  HTTPS_PREFIX_PATTERN,
  IMAGE_ALT_MAX,
  MAX_PRICE_CENTS,
  MAX_THEME_FEATURES,
  MAX_THEME_IMAGES,
  MIN_PRICE_CENTS,
  SEMVER_PATTERN,
  THEME_DESCRIPTION_MAX,
  THEME_DESCRIPTION_MIN,
  THEME_FEATURE_MAX,
  THEME_FEATURE_MIN,
  THEME_NAME_MAX,
  THEME_NAME_MIN,
  THEME_SLUG_PATTERN,
  THEME_STATUSES,
  THEME_TAGLINE_MAX,
  THEME_TAGLINE_MIN,
  WP_VERSION_PATTERN,
} from "@/features/themes/theme.constants";

// One picture of a theme. The first image of a theme is its cover.
const themeImageSchema = new Schema(
  {
    // Object key in the public bucket (not a URL, D-053).
    key: { type: String, required: true, trim: true },
    // Alternative text for screen readers.
    alt: { type: String, default: "", trim: true, maxlength: IMAGE_ALT_MAX },
    width: { type: Number, required: true, min: 1, validate: Number.isInteger },
    height: { type: Number, required: true, min: 1, validate: Number.isInteger },
  },
  { _id: false },
);

// Copy of the newest version's key data. Written only when a version is created.
const latestVersionSchema = new Schema(
  {
    versionId: { type: Schema.Types.ObjectId, ref: "Version", required: true },
    version: { type: String, required: true, match: SEMVER_PATTERN },
    releasedAt: { type: Date, required: true },
  },
  { _id: false },
);

// What the customer needs to run the theme.
const requirementsSchema = new Schema(
  {
    // Minimum WordPress version, e.g. "6.4".
    wordpressMin: { type: String, required: true, trim: true, match: WP_VERSION_PATTERN },
    // Minimum PHP version, e.g. "8.1".
    phpMin: { type: String, required: true, trim: true, match: WP_VERSION_PATTERN },
    // Newest WordPress version the theme was tested with.
    testedUpTo: { type: String, required: true, trim: true, match: WP_VERSION_PATTERN },
  },
  { _id: false },
);

const statsSchema = new Schema(
  {
    // Paid, non-refunded orders.
    salesCount: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
    // Every download.
    downloadCount: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
  },
  { _id: false },
);

// Link to the payment provider's product.
const providerSchema = new Schema(
  {
    // Matching product id at the payment provider.
    productId: { type: String, default: null },
    // Last successful sync to the payment provider.
    syncedAt: { type: Date, default: null },
  },
  { _id: false },
);

function hasAtMostFeatures(features: string[]): boolean {
  return features.length <= MAX_THEME_FEATURES;
}

function hasAtMostImages(images: unknown[]): boolean {
  return images.length <= MAX_THEME_IMAGES;
}

function hasUniqueImageKeys(images: { key: string }[]): boolean {
  return new Set(images.map((image) => image.key)).size === images.length;
}

const themeSchema = new Schema(
  {
    // Display name, e.g. "Aurora Blog".
    name: { type: String, required: true, trim: true, minlength: THEME_NAME_MIN, maxlength: THEME_NAME_MAX },
    // URL part, e.g. "aurora-blog". Unique. Editable only while publishedAt is null (D-017).
    slug: { type: String, required: true, trim: true, match: THEME_SLUG_PATTERN },
    // Lifecycle: draft → published ⇄ unpublished. See docs/03-data-model.md section 5.
    status: { type: String, required: true, enum: THEME_STATUSES, default: "draft" },
    // One line shown on cards, used as meta description and searched.
    tagline: { type: String, required: true, trim: true, minlength: THEME_TAGLINE_MIN, maxlength: THEME_TAGLINE_MAX },
    // Markdown. Not trimmed.
    description: { type: String, required: true, minlength: THEME_DESCRIPTION_MIN, maxlength: THEME_DESCRIPTION_MAX },
    // Feature bullets, shown as a list.
    features: {
      type: [{ type: String, trim: true, minlength: THEME_FEATURE_MIN, maxlength: THEME_FEATURE_MAX }],
      default: [],
      validate: hasAtMostFeatures,
    },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    // Price in US cents. 2900 = $29.00.
    priceCents: {
      type: Number,
      required: true,
      min: MIN_PRICE_CENTS,
      max: MAX_PRICE_CENTS,
      validate: Number.isInteger,
    },
    // Display order. The first image is the cover.
    images: { type: [themeImageSchema], default: [], validate: [hasAtMostImages, hasUniqueImageKeys] },
    // Link to a live demo (https only).
    demoUrl: { type: String, default: null, trim: true, maxlength: DEMO_URL_MAX, match: HTTPS_PREFIX_PATTERN },
    requirements: { type: requirementsSchema, required: true },
    // Shown in the "Featured" section of the home page.
    featured: { type: Boolean, required: true, default: false },
    latestVersion: { type: latestVersionSchema, default: null },
    // Set the first time the theme is published. Never changed after.
    publishedAt: { type: Date, default: null },
    stats: { type: statsSchema, required: true, default: () => ({}) },
    provider: { type: providerSchema, required: true, default: () => ({}) },
  },
  { collection: "themes", timestamps: true },
);

themeSchema.index({ slug: 1 }, { unique: true });
// Newest.
themeSchema.index({ status: 1, publishedAt: -1 });
// Category list.
themeSchema.index({ status: 1, categoryId: 1, publishedAt: -1 });
// Price sort.
themeSchema.index({ status: 1, priceCents: 1 });
// Best sellers.
themeSchema.index({ status: 1, "stats.salesCount": -1 });
// Home page.
themeSchema.index({ status: 1, featured: 1 });

export type ThemeRecord = InferSchemaType<typeof themeSchema> & { _id: Types.ObjectId };

// `models.Theme ||` stops hot reload from defining the model twice.
export const ThemeModel = (models.Theme as Model<ThemeRecord>) || model<ThemeRecord>("Theme", themeSchema);
