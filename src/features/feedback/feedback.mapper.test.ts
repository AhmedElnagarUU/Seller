import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { toFeedbackAdminListItemDTO } from "@/features/feedback/feedback.mapper";
import type { FeedbackRecord } from "@/features/feedback/feedback.model";

const CREATED_AT = new Date("2026-11-01T10:00:00Z");

describe("toFeedbackAdminListItemDTO", () => {
  it("turns _id into a string and carries customer name and email", () => {
    const record: FeedbackRecord = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      subject: "Question",
      message: "A message of ten+",
      status: "new",
      reply: null,
      repliedAt: null,
      repliedByUserId: null,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    };

    const dto = toFeedbackAdminListItemDTO(record, {
      id: record.userId.toString(),
      name: "Ann Lee",
      email: "ann@example.com",
    });

    expect(dto).toEqual({
      id: record._id.toString(),
      subject: "Question",
      createdAt: CREATED_AT,
      customerName: "Ann Lee",
      customerEmail: "ann@example.com",
    });
  });
});
