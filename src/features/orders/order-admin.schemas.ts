import { z } from "zod";
import { ORDER_METHODS, ORDER_STATUSES } from "@/features/orders/order.constants";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// A real calendar day as "YYYY-MM-DD": "2026-02-31" is refused.
function isRealDay(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

const dayField = z.string().regex(DAY_PATTERN).refine(isRealDay).optional().catch(undefined);

// The query of /admin/orders. A bad value falls back to its default (docs/05-pages.md section 1.4).
export const adminOrderSearchParamsSchema = z.object({
  method: z.enum(ORDER_METHODS).optional().catch(undefined),
  status: z.enum(ORDER_STATUSES).optional().catch(undefined),
  from: dayField,
  to: dayField,
  page: z.coerce.number().int().min(1).catch(1),
});

export const markRefundedSchema = z.object({
  orderId: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{24}$/i, "Not found."),
});
