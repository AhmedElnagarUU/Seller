import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { listActivity, log } from "@/features/activity/activity.service";
import type { ActivityLogInput } from "@/features/activity/activity.types";
import { withTransaction } from "@/shared/db/transaction";
import { setTestNow } from "@/shared/lib/clock";
import { createActivityLog, createAdmin, createUser } from "@/shared/test/factories";

const VALID_INPUT: ActivityLogInput = {
  action: "order_paid",
  actorRole: "system",
  summary: "Order paid: Aurora ($29.00)",
};
const MINUTE_MS = 60_000;

// A different time for each row: a higher number is newer.
function minute(number: number): Date {
  return new Date(Date.parse("2026-11-01T10:00:00Z") + number * MINUTE_MS);
}

function summariesOf(items: { summary: string }[]): string[] {
  return items.map((item) => item.summary);
}

describe("log", () => {
  it("saves one row with every given field", async () => {
    const fixedNow = new Date("2026-11-01T10:00:00Z");
    setTestNow(fixedNow);
    const admin = await createAdmin();
    const customer = await createUser();
    const themeId = new Types.ObjectId();

    await log({
      action: "ownership_granted",
      actorRole: "admin",
      actorUserId: admin._id.toString(),
      subjectUserId: customer._id.toString(),
      targetType: "theme",
      targetId: themeId.toString(),
      summary: "Theme granted: Aurora Blog",
    });

    const rows = await ActivityLogModel.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("ownership_granted");
    expect(rows[0]?.actorRole).toBe("admin");
    expect(rows[0]?.actorUserId?.toString()).toBe(admin._id.toString());
    expect(rows[0]?.subjectUserId?.toString()).toBe(customer._id.toString());
    expect(rows[0]?.targetType).toBe("theme");
    expect(rows[0]?.targetId?.toString()).toBe(themeId.toString());
    expect(rows[0]?.summary).toBe("Theme granted: Aurora Blog");
    expect(rows[0]?.createdAt).toEqual(fixedNow);
  });

  it("saves omitted nullable fields as null", async () => {
    await log(VALID_INPUT);

    const rows = await ActivityLogModel.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("order_paid");
    expect(rows[0]?.actorRole).toBe("system");
    expect(rows[0]?.summary).toBe("Order paid: Aurora ($29.00)");
    expect(rows[0]?.actorUserId).toBeNull();
    expect(rows[0]?.subjectUserId).toBeNull();
    expect(rows[0]?.targetType).toBeNull();
    expect(rows[0]?.targetId).toBeNull();
  });

  it("refuses a system entry that has an actor user", async () => {
    const customer = await createUser();
    const input = { ...VALID_INPUT, actorUserId: customer._id.toString() };

    const attempt = withTransaction((session) => log(input, session));

    await expect(attempt).rejects.toThrow(new Error("A system activity entry cannot have an actor user."));
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("is rolled back with its transaction", async () => {
    const attempt = withTransaction(async (session) => {
      await log(VALID_INPUT, session);
      throw new Error("boom");
    });

    await expect(attempt).rejects.toThrow(new Error("boom"));
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("throws inside a transaction when the summary is invalid", async () => {
    const attempt = withTransaction((session) => log({ ...VALID_INPUT, summary: "x" }, session));

    await expect(attempt).rejects.toMatchObject({ name: "ValidationError" });
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("never throws outside a transaction", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(log({ ...VALID_INPUT, summary: "x" })).resolves.toBeUndefined();

    expect(await ActivityLogModel.countDocuments()).toBe(0);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[0]).toBe("activity log failed");
    expect(consoleError.mock.calls[0]?.[1]).toBe("order_paid");
    consoleError.mockRestore();
  });
});

describe("activity model", () => {
  it("keeps rows for one year", async () => {
    await ActivityLogModel.init();

    const indexes = await ActivityLogModel.collection.indexes();
    const retentionIndex = indexes.find((index) => index.expireAfterSeconds !== undefined);
    expect(retentionIndex?.key).toEqual({ createdAt: 1 });
    expect(retentionIndex?.expireAfterSeconds).toBe(31536000);
  });
});

describe("listActivity", () => {
  async function createRows(count: number): Promise<void> {
    for (let number = 1; number <= count; number += 1) {
      await createActivityLog({ summary: `Row ${number}`, createdAt: minute(number) });
    }
  }

  it("returns the newest first with 20 per page", async () => {
    await createRows(25);

    const firstPage = await listActivity({ page: 1 });
    const secondPage = await listActivity({ page: 2 });

    expect(firstPage.items).toHaveLength(20);
    expect(firstPage.items[0]?.summary).toBe("Row 25");
    expect(firstPage.items[19]?.summary).toBe("Row 6");
    expect(firstPage.items[0]?.createdAt).toEqual(minute(25));
    expect(firstPage.page).toBe(1);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.total).toBe(25);
    expect(summariesOf(secondPage.items)).toEqual(["Row 5", "Row 4", "Row 3", "Row 2", "Row 1"]);
    expect(secondPage.totalPages).toBe(2);
    expect(secondPage.total).toBe(25);
  });

  it("returns an empty page above the last page", async () => {
    await createRows(25);

    const thirdPage = await listActivity({ page: 3 });

    expect(thirdPage.items).toEqual([]);
    expect(thirdPage.page).toBe(3);
    expect(thirdPage.totalPages).toBe(2);
    expect(thirdPage.total).toBe(25);
  });

  it("filters by action", async () => {
    await createActivityLog({ action: "order_paid", summary: "Order paid: Aurora" });
    await createActivityLog({ action: "feedback_sent", summary: "Feedback sent: Hello" });

    const result = await listActivity({ action: "order_paid" });

    expect(summariesOf(result.items)).toEqual(["Order paid: Aurora"]);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("filters by customer email ignoring case and spaces", async () => {
    const customerA = await createUser();
    const customerB = await createUser();
    await createActivityLog({ subjectUserId: customerA._id, summary: "About A, first", createdAt: minute(1) });
    await createActivityLog({ subjectUserId: customerB._id, summary: "About B", createdAt: minute(2) });
    await createActivityLog({ subjectUserId: customerA._id, summary: "About A, second", createdAt: minute(3) });

    const result = await listActivity({ customerEmail: ` ${customerA.email.toUpperCase()} ` });

    expect(summariesOf(result.items)).toEqual(["About A, second", "About A, first"]);
    expect(result.total).toBe(2);
  });

  it("combines the action and customer filters", async () => {
    const customerA = await createUser();
    const customerB = await createUser();
    await createActivityLog({ action: "order_paid", subjectUserId: customerA._id, summary: "A paid" });
    await createActivityLog({ action: "feedback_sent", subjectUserId: customerA._id, summary: "A wrote" });
    await createActivityLog({ action: "order_paid", subjectUserId: customerB._id, summary: "B paid" });

    const result = await listActivity({ action: "order_paid", customerEmail: customerA.email });

    expect(summariesOf(result.items)).toEqual(["A paid"]);
    expect(result.total).toBe(1);
  });

  it("returns an empty list for an email that no customer has", async () => {
    await createActivityLog();
    await createActivityLog({ subjectUserId: (await createUser())._id });

    const result = await listActivity({ customerEmail: "nobody@example.com" });

    expect(result).toEqual({ items: [], page: 1, totalPages: 0, total: 0 });
  });

  it("labels the actor", async () => {
    const admin = await createAdmin();
    const customer = await createUser({ name: "Ann Lee" });
    await createActivityLog({ actorRole: "system", summary: "By system", createdAt: minute(4) });
    await createActivityLog({ actorRole: "admin", actorUserId: admin._id, summary: "By admin", createdAt: minute(3) });
    await createActivityLog({
      actorRole: "customer",
      actorUserId: customer._id,
      summary: "By customer",
      createdAt: minute(2),
    });
    await createActivityLog({
      actorRole: "customer",
      actorUserId: new Types.ObjectId(),
      summary: "By deleted customer",
      createdAt: minute(1),
    });

    const result = await listActivity({});

    expect(result.items.map((item) => [item.summary, item.actorLabel])).toEqual([
      ["By system", "System"],
      ["By admin", "Admin"],
      ["By customer", "Ann Lee"],
      ["By deleted customer", "Unknown customer"],
    ]);
  });
});
