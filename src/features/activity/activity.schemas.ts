import { z } from "zod";
import { ACTIVITY_ACTIONS } from "@/features/activity/activity.constants";

// Query params of /admin/activity. A bad value falls back to its default (docs/05-pages.md 1.4).
export const activitySearchParamsSchema = z.object({
  action: z.enum(ACTIVITY_ACTIONS).optional().catch(undefined),
  customer: z.string().trim().catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});
