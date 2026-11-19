import { describe, expect, it } from "vitest";
import { withTransaction } from "@/shared/db/transaction";
import { setTestNow } from "@/shared/lib/clock";
import { createUser } from "@/shared/test/factories";
import { NotificationModel } from "@/features/notifications/notification.model";
import { createNotification } from "@/features/notifications/notification.service";

const NOW = new Date("2026-11-01T10:00:00Z");

describe("createNotification", () => {
  it("saves the notification with readAt null, jobId null and createdAt = now", async () => {
    setTestNow(NOW);
    const user = await createUser();

    await createNotification({
      userId: user._id.toString(),
      type: "wallet_payment_approved",
      title: "Payment approved: Aurora",
      body: "Your payment was confirmed.",
      link: "/account/themes",
    });

    const saved = await NotificationModel.find().lean();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.userId.toString()).toBe(user._id.toString());
    expect(saved[0]?.type).toBe("wallet_payment_approved");
    expect(saved[0]?.title).toBe("Payment approved: Aurora");
    expect(saved[0]?.body).toBe("Your payment was confirmed.");
    expect(saved[0]?.link).toBe("/account/themes");
    expect(saved[0]?.readAt).toBeNull();
    expect(saved[0]?.jobId).toBeNull();
    expect(saved[0]?.createdAt).toEqual(NOW);
  });

  it("saves nothing when the surrounding transaction throws", async () => {
    const user = await createUser();
    await NotificationModel.createCollection();

    await expect(
      withTransaction(async (session) => {
        await createNotification(
          { userId: user._id.toString(), type: "announcement", title: "Hello", body: "A message.", link: null },
          session,
        );
        throw new Error("boom");
      }),
    ).rejects.toThrowError("boom");

    expect(await NotificationModel.countDocuments()).toBe(0);
  });
});
