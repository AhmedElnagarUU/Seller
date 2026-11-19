import { z } from "zod";
import { OBJECT_ID_PATTERN } from "@/features/themes/theme.constants";
import { CUSTOMER_MESSAGES, GRANT_NOTE_MAX, REVOKE_NOTE_MAX, REVOKE_NOTE_MIN } from "@/features/users/user.constants";

const userIdField = z.string().regex(OBJECT_ID_PATTERN, CUSTOMER_MESSAGES.notFound);
const themeIdField = z.string().regex(OBJECT_ID_PATTERN, "Theme not found.");

export const grantThemeSchema = z.object({
  userId: userIdField,
  themeId: themeIdField,
  note: z.string().trim().max(GRANT_NOTE_MAX, CUSTOMER_MESSAGES.grantNoteLength),
});

export const revokeOwnershipSchema = z.object({
  userId: userIdField,
  themeId: themeIdField,
  note: z
    .string()
    .trim()
    .min(REVOKE_NOTE_MIN, CUSTOMER_MESSAGES.revokeNoteLength)
    .max(REVOKE_NOTE_MAX, CUSTOMER_MESSAGES.revokeNoteLength),
});
