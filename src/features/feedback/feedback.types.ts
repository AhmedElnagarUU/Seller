import type { FeedbackStatus } from "@/features/feedback/feedback.constants";

export type FeedbackInput = { subject: string; message: string };

export type FeedbackDTO = {
  id: string;
  subject: string;
  message: string;
  status: FeedbackStatus;
  createdAt: Date;
  reply: string | null;
  repliedAt: Date | null;
};

export type FeedbackAdminListItemDTO = {
  id: string;
  subject: string;
  createdAt: Date;
  customerName: string;
  customerEmail: string;
};

export type FeedbackAdminPageDTO = {
  items: FeedbackAdminListItemDTO[];
  page: number;
  totalPages: number;
  total: number;
};

export type FeedbackAdminDTO = FeedbackDTO & {
  customer: { id: string; name: string; email: string };
};

// What the feedback reply email needs.
export type FeedbackEmailData = {
  id: string;
  userName: string;
  userEmail: string;
  subject: string;
  reply: string;
};
