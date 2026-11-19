import { z } from "zod";
import { DASHBOARD_RANGES, DEFAULT_DASHBOARD_RANGE } from "@/features/orders/dashboard.constants";

// The query of /admin. A bad range falls back to the default.
export const dashboardSearchParamsSchema = z.object({
  range: z.enum(DASHBOARD_RANGES).catch(DEFAULT_DASHBOARD_RANGE),
});
