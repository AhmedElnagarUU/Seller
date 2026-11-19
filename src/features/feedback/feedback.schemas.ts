import { z } from "zod";
import { OBJECT_ID_PATTERN } from "@/features/themes/theme.constants";
import {
  FEEDBACK_MESSAGES,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  FEEDBACK_REPLY_MAX,
  FEEDBACK_REPLY_MIN,
  FEEDBACK_STATUSES,
  FEEDBACK_SUBJECT_MAX,
  FEEDBACK_SUBJECT_MIN,
} from "@/features/feedback/feedback.constants";

const idField = z.string().regex(OBJECT_ID_PATTERN, FEEDBACK_MESSAGES.notFound);

export const feedbackInputSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(FEEDBACK_SUBJECT_MIN, FEEDBACK_MESSAGES.subjectLength)
    .max(FEEDBACK_SUBJECT_MAX, FEEDBACK_MESSAGES.subjectLength),
  message: z
    .string()
    .trim()
    .min(FEEDBACK_MESSAGE_MIN, FEEDBACK_MESSAGES.messageLength)
    .max(FEEDBACK_MESSAGE_MAX, FEEDBACK_MESSAGES.messageLength),
});

export const feedbackReplySchema = z.object({
  id: idField,
  reply: z
    .string()
    .trim()
    .min(FEEDBACK_REPLY_MIN, FEEDBACK_MESSAGES.replyLength)
    .max(FEEDBACK_REPLY_MAX, FEEDBACK_MESSAGES.replyLength),
});

export const feedbackIdSchema = z.object({ id: idField });

// The query of /admin/feedback. A bad value falls back to the "new" tab and page 1 (docs/05-pages.md section 1.4).
export const feedbackSearchParamsSchema = z.object({
  tab: z.enum(FEEDBACK_STATUSES).catch("new"),
  page: z.coerce.number().int().min(1).catch(1),
});
