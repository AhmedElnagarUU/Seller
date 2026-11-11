export const THEME_STATUSES = ["draft", "published", "unpublished"] as const;
export type ThemeStatus = (typeof THEME_STATUSES)[number];

export const THEME_STATUS_LABELS: Record<ThemeStatus, string> = {
  draft: "Draft",
  published: "Published",
  unpublished: "Unpublished",
};

export const THEME_SORTS = ["newest", "best", "price-asc", "price-desc"] as const;
export type ThemeSort = (typeof THEME_SORTS)[number];
export const DEFAULT_THEME_SORT: ThemeSort = "newest";
export const THEME_SORT_LABELS: Record<ThemeSort, string> = {
  newest: "Newest",
  best: "Best selling",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
};

export const THEME_NAME_MIN = 2;
export const THEME_NAME_MAX = 80;
export const THEME_TAGLINE_MIN = 10;
export const THEME_TAGLINE_MAX = 160;
export const THEME_DESCRIPTION_MIN = 50;
export const THEME_DESCRIPTION_MAX = 20_000;
export const THEME_FEATURE_MIN = 2;
export const THEME_FEATURE_MAX = 120;
export const MAX_THEME_FEATURES = 30;
export const MIN_PRICE_CENTS = 100;
export const MAX_PRICE_CENTS = 100_000;
export const DEMO_URL_MAX = 500;
export const MAX_THEME_IMAGES = 12;
export const IMAGE_ALT_MAX = 150;
export const MAX_IMAGE_BYTES = 3_145_728;
export const IMAGE_MIN_PX = 400;
export const IMAGE_MAX_PX = 6000;
export const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const IMAGE_UPLOAD_SECONDS = 600;
export const SEARCH_TEXT_MAX = 80;

export const THEMES_PER_PAGE = 20;
export const HOME_SECTION_SIZE = 6;

// "slug" format of docs/03-data-model.md: lowercase words joined by single dashes, 2 to 80 characters.
export const THEME_SLUG_PATTERN = /^(?=.{2,80}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
// "wpVersion" format: 6.4 or 8.1.2.
export const WP_VERSION_PATTERN = /^\d+\.\d+(\.\d+)?$/;
// "semver" format: 1.4.0 (no leading zeros).
export const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
// "httpsUrl" format, first part: the address must start with https://.
export const HTTPS_PREFIX_PATTERN = /^https:\/\//;
// A MongoDB ObjectId written as text.
export const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
