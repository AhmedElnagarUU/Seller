import type { FeedbackRecord } from "@/features/feedback/feedback.model";
import type {
  FeedbackAdminDTO,
  FeedbackAdminListItemDTO,
  FeedbackDTO,
  FeedbackEmailData,
} from "@/features/feedback/feedback.types";

type Customer = { id: string; name: string; email: string };

export function toFeedbackDTO(record: FeedbackRecord): FeedbackDTO {
  return {
    id: record._id.toString(),
    subject: record.subject,
    message: record.message,
    status: record.status,
    createdAt: record.createdAt,
    reply: record.reply ?? null,
    repliedAt: record.repliedAt ?? null,
  };
}

export function toFeedbackAdminListItemDTO(record: FeedbackRecord, customer: Customer): FeedbackAdminListItemDTO {
  return {
    id: record._id.toString(),
    subject: record.subject,
    createdAt: record.createdAt,
    customerName: customer.name,
    customerEmail: customer.email,
  };
}

export function toFeedbackAdminDTO(record: FeedbackRecord, customer: Customer): FeedbackAdminDTO {
  return { ...toFeedbackDTO(record), customer };
}

// Only called for a row that has a reply.
export function toFeedbackEmailData(record: FeedbackRecord, user: { name: string; email: string }): FeedbackEmailData {
  return {
    id: record._id.toString(),
    userName: user.name,
    userEmail: user.email,
    subject: record.subject,
    reply: record.reply ?? "",
  };
}
