import { z } from "zod";
import {
  CATEGORY_DESCRIPTION_MAX,
  CATEGORY_NAME_MAX,
  CATEGORY_NAME_MIN,
  CATEGORY_SLUG_PATTERN,
  CATEGORY_SORT_ORDER_MAX,
  CATEGORY_SORT_ORDER_MIN,
} from "@/features/categories/category.constants";

const NAME_MESSAGE = "Use 2 to 40 characters.";
const SLUG_MESSAGE = "Use lowercase letters, numbers and dashes.";
const DESCRIPTION_MESSAGE = "Use up to 300 characters.";
const SORT_ORDER_MESSAGE = "Enter a whole number.";

function isSortOrder(value: number): boolean {
  return Number.isInteger(value) && value >= CATEGORY_SORT_ORDER_MIN && value <= CATEGORY_SORT_ORDER_MAX;
}

export const categoryInputSchema = z.object({
  name: z.string().trim().min(CATEGORY_NAME_MIN, NAME_MESSAGE).max(CATEGORY_NAME_MAX, NAME_MESSAGE),
  slug: z.string().trim().regex(CATEGORY_SLUG_PATTERN, SLUG_MESSAGE),
  description: z
    .string()
    .trim()
    .max(CATEGORY_DESCRIPTION_MAX, DESCRIPTION_MESSAGE)
    .transform((value) => (value === "" ? null : value)),
  sortOrder: z.coerce.number({ error: SORT_ORDER_MESSAGE }).refine(isSortOrder, SORT_ORDER_MESSAGE),
});

export type CategoryInput = z.output<typeof categoryInputSchema>;
