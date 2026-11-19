import { withTransaction } from "@/shared/db/transaction";
import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import * as activityService from "@/features/activity/activity.service";
import { sendFeedbackReplyEmail } from "@/features/emails/email.service";
import {
  FEEDBACK_LIMIT_PER_DAY,
  FEEDBACK_LIMIT_WINDOW_HOURS,
  FEEDBACK_MESSAGES,
  FEEDBACK_PER_PAGE,
  FEEDBACK_RATE_LIMIT_MESSAGE,
  type FeedbackStatus,
} from "@/features/feedback/feedback.constants";
import { toFeedbackAdminDTO, toFeedbackAdminListItemDTO, toFeedbackDTO } from "@/features/feedback/feedback.mapper";
import type { FeedbackRecord } from "@/features/feedback/feedback.model";
import * as feedbackRepository from "@/features/feedback/feedback.repository";
import type {
  FeedbackAdminDTO,
  FeedbackAdminPageDTO,
  FeedbackDTO,
  FeedbackInput,
} from "@/features/feedback/feedback.types";
import { createNotification } from "@/features/notifications/notification.service";
import { buildFeedbackReplyText } from "@/features/notifications/notification.texts";
import { getUserSummaries, getUserSummary } from "@/features/users/user.service";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const UNKNOWN_CUSTOMER = "—";

async function loadFeedback(id: string): Promise<FeedbackRecord> {
  const record = await feedbackRepository.findFeedbackById(id);
  if (!record) throw new AppError("NOT_FOUND", FEEDBACK_MESSAGES.notFound);
  return record;
}

// Saves a message of a customer. At most 5 messages in 24 hours (03 §14).
export async function sendFeedback(userId: string, input: FeedbackInput): Promise<{ id: string }> {
  const since = new Date(now().getTime() - FEEDBACK_LIMIT_WINDOW_HOURS * MILLISECONDS_PER_HOUR);
  const recentCount = await feedbackRepository.countFeedbackSince(userId, since);
  if (recentCount >= FEEDBACK_LIMIT_PER_DAY) throw new AppError("RATE_LIMITED", FEEDBACK_RATE_LIMIT_MESSAGE);
  const created = await feedbackRepository.insertFeedback(userId, input.subject, input.message);
  const id = created._id.toString();
  await activityService.log({
    action: "feedback_sent",
    actorRole: "customer",
    actorUserId: userId,
    subjectUserId: userId,
    targetType: "feedback",
    targetId: id,
    summary: `Feedback sent: ${created.subject}`,
  });
  return { id };
}

// The messages of one customer, newest first.
export async function listFeedbackForUser(userId: string): Promise<FeedbackDTO[]> {
  const records = await feedbackRepository.listFeedbackByUser(userId);
  return records.map(toFeedbackDTO);
}

// One page of the messages of a tab. Customer name and email come from ONE user query.
export async function listFeedbackForAdmin(input: {
  status: FeedbackStatus;
  page: number;
}): Promise<FeedbackAdminPageDTO> {
  const page = Math.max(1, input.page);
  const [records, total] = await Promise.all([
    feedbackRepository.findFeedbackPage(input.status, page, FEEDBACK_PER_PAGE),
    feedbackRepository.countFeedback(input.status),
  ]);
  const customers = await getUserSummaries(records.map((record) => record.userId.toString()));
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  return {
    items: records.map((record) => {
      const customer = customersById.get(record.userId.toString());
      return toFeedbackAdminListItemDTO(record, {
        id: record.userId.toString(),
        name: customer?.name ?? UNKNOWN_CUSTOMER,
        email: customer?.email ?? UNKNOWN_CUSTOMER,
      });
    }),
    page,
    totalPages: Math.ceil(total / FEEDBACK_PER_PAGE),
    total,
  };
}

// One message for the admin page, or null for an unknown or invalid id. A "new" message becomes "read" (03 §14).
export async function openFeedbackForAdmin(id: string): Promise<FeedbackAdminDTO | null> {
  const record = await feedbackRepository.findFeedbackById(id);
  if (!record) return null;
  await feedbackRepository.markFeedbackReadIfNew(id);
  const customer = await getUserSummary(record.userId.toString());
  return toFeedbackAdminDTO(
    { ...record, status: record.status === "new" ? "read" : record.status },
    {
      id: record.userId.toString(),
      name: customer?.name ?? UNKNOWN_CUSTOMER,
      email: customer?.email ?? UNKNOWN_CUSTOMER,
    },
  );
}

// Saves the one reply, notifies the customer (same transaction), then emails the customer. A failed email is
// logged and does not fail the reply (docs/09-emails.md section 1.3). The status does not change.
export async function replyToFeedback(id: string, reply: string, adminUserId: string): Promise<void> {
  const record = await loadFeedback(id);
  if (record.reply) throw new AppError("CONFLICT", FEEDBACK_MESSAGES.alreadyReplied);
  await withTransaction(async (session) => {
    const updated = await feedbackRepository.setFeedbackReply(id, reply, now(), adminUserId, session);
    if (!updated) throw new AppError("CONFLICT", FEEDBACK_MESSAGES.alreadyReplied);
    await createNotification(
      {
        userId: record.userId.toString(),
        type: "feedback_reply",
        ...buildFeedbackReplyText({ subject: record.subject }),
      },
      session,
    );
  });
  try {
    await sendFeedbackReplyEmail({ feedbackId: id });
  } catch {
    // Never log the error object: it could carry the reply text.
    console.error("replyToFeedback email failed");
  }
}

// Marks a message as resolved, from "new" or "read".
export async function resolveFeedback(id: string): Promise<void> {
  await loadFeedback(id);
  await feedbackRepository.setFeedbackStatus(id, "resolved");
}

// A resolved message becomes "read" again (05 §5). Another status is left as it is.
export async function reopenFeedback(id: string): Promise<void> {
  const record = await loadFeedback(id);
  if (record.status !== "resolved") return;
  await feedbackRepository.setFeedbackStatus(id, "read");
}

// The number of messages nobody opened yet (the admin menu badge and the dashboard).
export async function countNewFeedback(): Promise<number> {
  return feedbackRepository.countFeedbackByStatus("new");
}
