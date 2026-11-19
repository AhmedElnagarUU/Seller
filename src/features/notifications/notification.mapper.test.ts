import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { toNotificationDTO } from "@/features/notifications/notification.mapper";
import type { NotificationRecord } from "@/features/notifications/notification.model";

const CREATED_AT = new Date("2026-11-01T10:00:00Z");

function buildRecord(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    type: "announcement",
    title: "Big sale",
    body: "Everything is cheaper this week.",
    link: "/themes",
    readAt: null,
    jobId: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

describe("toNotificationDTO", () => {
  it("maps readAt null to isRead false and keeps the other fields", () => {
    const record = buildRecord();

    expect(toNotificationDTO(record)).toEqual({
      id: record._id.toString(),
      type: "announcement",
      title: "Big sale",
      body: "Everything is cheaper this week.",
      link: "/themes",
      isRead: false,
      createdAt: CREATED_AT,
    });
  });

  it("maps a date in readAt to isRead true", () => {
    const dto = toNotificationDTO(buildRecord({ readAt: new Date("2026-11-02T10:00:00Z") }));

    expect(dto.isRead).toBe(true);
  });

  it("keeps link null", () => {
    const dto = toNotificationDTO(buildRecord({ link: null }));

    expect(dto.link).toBeNull();
  });
});
