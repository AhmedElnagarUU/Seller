import { toFeedbackEmailData } from "@/features/feedback/feedback.mapper";
import * as feedbackRepository from "@/features/feedback/feedback.repository";
import type { FeedbackEmailData } from "@/features/feedback/feedback.types";
import { getUserSummary } from "@/features/users/user.service";

// The data of the feedback reply email, or null when the message has no reply or its customer does not exist.
// It does not import email.service.ts, because email.service.ts imports this file.
export async function getFeedbackEmailData(id: string): Promise<FeedbackEmailData | null> {
  const record = await feedbackRepository.findFeedbackById(id);
  if (!record?.reply) return null;
  const user = await getUserSummary(record.userId.toString());
  if (!user) return null;
  return toFeedbackEmailData(record, user);
}
