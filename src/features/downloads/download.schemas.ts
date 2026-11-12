import { z } from "zod";
import { DOWNLOAD_ERROR_KEYS } from "@/features/downloads/download.constants";

// The query of /account/themes. Any other value of downloadError is ignored (docs/07-delivery-updates.md 7.2).
export const downloadErrorSearchParamsSchema = z.object({
  downloadError: z.enum(DOWNLOAD_ERROR_KEYS).optional().catch(undefined),
});
