import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { toActivityLogDTO } from "@/features/activity/activity.mapper";
import { createActivityLog } from "@/shared/test/factories";

describe("toActivityLogDTO", () => {
  it("builds the admin path of the target", async () => {
    const targetId = new Types.ObjectId();
    const createdAt = new Date("2026-11-01T10:00:00Z");
    const themeRow = await createActivityLog({
      targetType: "theme",
      targetId,
      summary: "Theme published: Aurora",
      createdAt,
    });
    const orderRow = await createActivityLog({ targetType: "order", targetId });
    const userRow = await createActivityLog({ targetType: "user", targetId });

    const themeEntry = toActivityLogDTO(themeRow, "Admin");

    expect(themeEntry).toEqual({
      id: themeRow._id.toString(),
      createdAt,
      actorLabel: "Admin",
      summary: "Theme published: Aurora",
      targetPath: `/admin/themes/${targetId.toString()}`,
    });
    expect(toActivityLogDTO(orderRow, "System").targetPath).toBe(`/admin/orders/${targetId.toString()}`);
    expect(toActivityLogDTO(userRow, "System").targetPath).toBe(`/admin/customers/${targetId.toString()}`);
  });

  it("gives no link for `notification_job` or for a row without target", async () => {
    const jobRow = await createActivityLog({ targetType: "notification_job", targetId: new Types.ObjectId() });
    const plainRow = await createActivityLog();

    expect(toActivityLogDTO(jobRow, "System").targetPath).toBeNull();
    expect(toActivityLogDTO(plainRow, "System").targetPath).toBeNull();
  });
});
