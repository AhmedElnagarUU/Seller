import { z } from "zod";

// The query of /account/orders. A bad value falls back to page 1 (docs/05-pages.md 1.4).
export const orderListSearchParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
});
