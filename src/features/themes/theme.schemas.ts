import { z } from "zod";
import {
  DEFAULT_THEME_SORT,
  DEMO_URL_MAX,
  HTTPS_PREFIX_PATTERN,
  MAX_THEME_FEATURES,
  OBJECT_ID_PATTERN,
  SEARCH_TEXT_MAX,
  THEME_DESCRIPTION_MAX,
  THEME_DESCRIPTION_MIN,
  THEME_FEATURE_MAX,
  THEME_FEATURE_MIN,
  THEME_NAME_MAX,
  THEME_NAME_MIN,
  THEME_SLUG_PATTERN,
  THEME_SORTS,
  THEME_STATUSES,
  THEME_TAGLINE_MAX,
  THEME_TAGLINE_MIN,
  WP_VERSION_PATTERN,
} from "@/features/themes/theme.constants";

const NAME_MESSAGE = "Use 2 to 80 characters.";
const SLUG_MESSAGE = "Use lowercase letters, numbers and dashes.";
const TAGLINE_MESSAGE = "Use 10 to 160 characters.";
const FEATURES_MESSAGE = "Each feature needs 2 to 120 characters (max 30 features).";
const CATEGORY_MESSAGE = "Choose a category.";
const PRICE_MESSAGE = "Enter a price between $1.00 and $1,000.00.";
const DEMO_URL_MESSAGE = "Enter a full https:// address.";
const VERSION_MESSAGE = "Use a version like 6.4.";

const MIN_PRICE_DOLLARS = 1;
const MAX_PRICE_DOLLARS = 1000;
const CENTS_PER_DOLLAR = 100;

function isPriceInDollars(value: number): boolean {
  const hasAtMostTwoDecimals = Math.round(value * CENTS_PER_DOLLAR) / CENTS_PER_DOLLAR === value;
  return value >= MIN_PRICE_DOLLARS && value <= MAX_PRICE_DOLLARS && hasAtMostTwoDecimals;
}

function isHttpsUrl(value: string): boolean {
  if (!HTTPS_PREFIX_PATTERN.test(value)) return false;
  return URL.canParse(value);
}

function isDemoUrlOrEmpty(value: string): boolean {
  if (value === "") return true;
  return value.length <= DEMO_URL_MAX && isHttpsUrl(value);
}

function areValidFeatures(features: string[]): boolean {
  if (features.length > MAX_THEME_FEATURES) return false;
  return features.every((feature) => feature.length >= THEME_FEATURE_MIN && feature.length <= THEME_FEATURE_MAX);
}

const versionField = z.string().trim().regex(WP_VERSION_PATTERN, VERSION_MESSAGE);

// The form sends the price in dollars as text. The result has `priceCents` instead of `price`.
export const themeInputSchema = z
  .object({
    name: z.string().trim().min(THEME_NAME_MIN, NAME_MESSAGE).max(THEME_NAME_MAX, NAME_MESSAGE),
    slug: z.string().trim().regex(THEME_SLUG_PATTERN, SLUG_MESSAGE),
    tagline: z.string().trim().min(THEME_TAGLINE_MIN, TAGLINE_MESSAGE).max(THEME_TAGLINE_MAX, TAGLINE_MESSAGE),
    description: z
      .string()
      .min(THEME_DESCRIPTION_MIN, "Write at least 50 characters.")
      .max(THEME_DESCRIPTION_MAX, "The description is too long."),
    features: z.array(z.string().trim()).refine(areValidFeatures, FEATURES_MESSAGE),
    categoryId: z.string().trim().regex(OBJECT_ID_PATTERN, CATEGORY_MESSAGE),
    price: z.coerce.number({ error: PRICE_MESSAGE }).refine(isPriceInDollars, PRICE_MESSAGE),
    demoUrl: z
      .string()
      .trim()
      .refine(isDemoUrlOrEmpty, DEMO_URL_MESSAGE)
      .transform((value) => (value === "" ? null : value)),
    wordpressMin: versionField,
    phpMin: versionField,
    testedUpTo: versionField,
    featured: z.boolean(),
  })
  .transform(({ price, ...fields }) => ({ ...fields, priceCents: Math.round(price * CENTS_PER_DOLLAR) }));

export type ThemeInput = z.output<typeof themeInputSchema>;

// Query params of /themes and /categories/[slug]. A bad value falls back to its default (docs/05-pages.md 1.4).
export const themeSearchParamsSchema = z.object({
  q: z.string().trim().max(SEARCH_TEXT_MAX).catch(""),
  category: z.string().trim().catch(""),
  sort: z.enum(THEME_SORTS).catch(DEFAULT_THEME_SORT),
  page: z.coerce.number().int().min(1).catch(1),
});

// Query params of /admin/themes.
export const adminThemeSearchParamsSchema = z.object({
  status: z.enum(THEME_STATUSES).optional().catch(undefined),
  q: z.string().trim().max(SEARCH_TEXT_MAX).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});
