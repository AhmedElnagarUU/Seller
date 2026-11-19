import { z } from "zod";
import { OBJECT_ID_PATTERN } from "@/features/themes/theme.constants";
import {
  CUSTOMER_MESSAGES,
  CUSTOMER_SEARCH_MAX,
  CUSTOMER_STATUS_FILTERS,
  DISABLE_REASON_MAX,
  DISABLE_REASON_MIN,
} from "@/features/users/user.constants";

const idField = z.string().regex(OBJECT_ID_PATTERN, CUSTOMER_MESSAGES.notFound);

export const customerIdSchema = z.object({ id: idField });

export const disableCustomerSchema = z.object({
  id: idField,
  reason: z
    .string()
    .trim()
    .min(DISABLE_REASON_MIN, CUSTOMER_MESSAGES.reasonLength)
    .max(DISABLE_REASON_MAX, CUSTOMER_MESSAGES.reasonLength),
});

// The query of /admin/customers. A bad value falls back to "no search", "all" and page 1.
export const customerSearchParamsSchema = z.object({
  q: z.string().trim().max(CUSTOMER_SEARCH_MAX).catch(""),
  status: z.enum(CUSTOMER_STATUS_FILTERS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
});
