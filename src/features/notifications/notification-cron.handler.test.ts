import { describe, expect, it } from "vitest";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";
import { handleNotificationCron } from "@/features/notifications/notification-cron.handler";
import { setTestNow } from "@/shared/lib/clock";
import { createNotificationJob, createOwnership, createTheme, createUser } from "@/shared/test/factories";

const NOW = new Date("2026-11-01T10:00:00Z");
const CRON_URL = "http://localhost:3000/api/cron/process-notifications";

function buildRequest(authorization: string | null): Request {
  const headers: Record<string, string> = authorization === null ? {} : { Authorization: authorization };
  return new Request(CRON_URL, { method: "POST", headers });
}

describe("handleNotificationCron", () => {
  it("refuses a missing, a wrong and a wrong-length secret with status 401 and an empty body; the pending job is unchanged", async () => {
    setTestNow(NOW);
    const theme = await createTheme({ status: "published" });
    const owner = await createUser();
    await createOwnership(owner._id.toString(), theme._id.toString());
    const job = await createNotificationJob({ themeId: theme._id });
    const correctSecret = process.env.CRON_SECRET ?? "";
    const wrongSecrets = [
      null,
      `Bearer ${"x".repeat(correctSecret.length)}`,
      `Bearer ${correctSecret}x`,
      "Bearer wrong",
      correctSecret,
    ];

    for (const authorization of wrongSecrets) {
      const response = await handleNotificationCron(buildRequest(authorization));

      expect(response.status).toBe(401);
      expect(await response.text()).toBe("");
    }

    const saved = await NotificationJobModel.findById(job._id).lean();
    expect(saved?.status).toBe("pending");
    expect(saved?.attempts).toBe(0);
    expect(saved?.notifiedCount).toBe(0);
    expect(saved?.lockedUntil).toBeNull();
    expect(saved?.startedAt).toBeNull();
  });

  it("the correct secret gives status 200 and JSON { processedBatches, finishedJobs } with the real numbers; the job is done", async () => {
    setTestNow(NOW);
    const theme = await createTheme({ status: "published" });
    const owner = await createUser();
    await createOwnership(owner._id.toString(), theme._id.toString());
    const job = await createNotificationJob({ themeId: theme._id });

    const response = await handleNotificationCron(buildRequest(`Bearer ${process.env.CRON_SECRET}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processedBatches: 3, finishedJobs: 1 });
    const saved = await NotificationJobModel.findById(job._id).lean();
    expect(saved?.status).toBe("done");
    expect(saved?.notifiedCount).toBe(1);
  });
});
