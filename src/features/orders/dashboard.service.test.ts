import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { DownloadLogModel } from "@/features/downloads/download-log.model";
import { dashboardSearchParamsSchema } from "@/features/orders/dashboard.schemas";
import { getDashboard } from "@/features/orders/dashboard.service";
import { setTestNow } from "@/shared/lib/clock";
import {
  createActivityLog,
  createFeedback,
  createOrder,
  createTheme,
  createUser,
  createVersion,
  createWalletPayment,
} from "@/shared/test/factories";

const NOW = new Date("2026-11-10T12:00:00Z");
const RECENT = new Date("2026-11-05T10:00:00Z");
const OLD = new Date("2026-08-01T10:00:00Z");

function allTimeOf(rows: { period: string; orders: number; revenueAmount: number }[]) {
  return rows.find((row) => row.period === "allTime");
}

async function createDownload(themeId: string, versionId: string, createdAt: Date): Promise<void> {
  const log = await DownloadLogModel.create({
    userId: new Types.ObjectId(),
    themeId: new Types.ObjectId(themeId),
    versionId: new Types.ObjectId(versionId),
  });
  await DownloadLogModel.collection.updateOne({ _id: log._id }, { $set: { createdAt } });
}

describe("getDashboard", () => {
  it("keeps USD (card) and EGP (wallet) separate and never adds them", async () => {
    setTestNow(NOW);
    await createOrder({ method: "card", currency: "usd", totalAmount: 2900, paidAt: RECENT });
    await createOrder({ method: "wallet", currency: "egp", totalAmount: 145000, paidAt: RECENT });

    const dashboard = await getDashboard("30d");

    expect(allTimeOf(dashboard.sales.usd)).toEqual({ period: "allTime", orders: 1, revenueAmount: 2900 });
    expect(allTimeOf(dashboard.sales.egp)).toEqual({ period: "allTime", orders: 1, revenueAmount: 145000 });
    expect(dashboard.sales.usd.map((row) => row.period)).toEqual(["today", "last7days", "last30days", "allTime"]);
    expect(dashboard.sales.egp).toHaveLength(4);
  });

  it("counts partly refunded orders net of the refund and ignores refunded ones", async () => {
    setTestNow(NOW);
    await createOrder({ status: "paid", totalAmount: 2900, paidAt: RECENT });
    await createOrder({ status: "partially_refunded", totalAmount: 2900, refundedAmount: 1000, paidAt: RECENT });
    await createOrder({ status: "refunded", totalAmount: 2900, refundedAmount: 2900, paidAt: RECENT });

    const dashboard = await getDashboard("30d");

    expect(allTimeOf(dashboard.sales.usd)).toEqual({ period: "allTime", orders: 2, revenueAmount: 4800 });
  });

  it("cuts the periods as in 18-A", async () => {
    setTestNow(NOW);
    const paidTimes = [
      "2026-11-10T00:00:00Z",
      "2026-11-09T23:59:59Z",
      "2026-11-03T12:00:00Z",
      "2026-11-03T11:59:59Z",
      "2026-10-11T12:00:00Z",
      "2026-10-11T11:59:59Z",
    ];
    for (const paidAt of paidTimes) {
      await createOrder({ paidAt: new Date(paidAt) });
    }

    const dashboard = await getDashboard("30d");

    expect(dashboard.sales.usd.map((row) => [row.period, row.orders, row.revenueAmount])).toEqual([
      ["today", 1, 2900],
      ["last7days", 3, 8700],
      ["last30days", 5, 14500],
      ["allTime", 6, 17400],
    ]);
  });

  it("ranks top themes by sales for 30 days and for all time", async () => {
    setTestNow(NOW);
    const themeA = await createTheme({ name: "Theme A", status: "published" });
    const themeB = await createTheme({ name: "Theme B", status: "published" });
    for (let index = 0; index < 3; index += 1) await createOrder({ themeId: themeA._id, paidAt: RECENT });
    await createOrder({ themeId: themeB._id, paidAt: RECENT });
    for (let index = 0; index < 4; index += 1) await createOrder({ themeId: themeB._id, paidAt: OLD });
    await createOrder({ themeId: themeA._id, status: "refunded", refundedAmount: 2900, paidAt: RECENT });
    for (let index = 0; index < 6; index += 1) {
      const other = await createTheme({ status: "published" });
      await createOrder({ themeId: other._id, paidAt: OLD });
    }

    const recent = await getDashboard("30d");
    const all = await getDashboard("all");

    expect(recent.range).toBe("30d");
    expect(recent.topThemesBySales).toEqual([
      { themeId: themeA._id.toString(), themeName: "Theme A", count: 3 },
      { themeId: themeB._id.toString(), themeName: "Theme B", count: 1 },
    ]);
    expect(all.range).toBe("all");
    expect(all.topThemesBySales).toHaveLength(5);
    expect(all.topThemesBySales.slice(0, 2)).toEqual([
      { themeId: themeB._id.toString(), themeName: "Theme B", count: 5 },
      { themeId: themeA._id.toString(), themeName: "Theme A", count: 3 },
    ]);
  });

  it("ranks top themes by downloads for 30 days and for all time", async () => {
    setTestNow(NOW);
    const themeA = await createTheme({ name: "Theme A", status: "published" });
    const themeB = await createTheme({ name: "Theme B", status: "published" });
    const versionA = await createVersion(themeA._id.toString());
    const versionB = await createVersion(themeB._id.toString());
    for (let index = 0; index < 3; index += 1) {
      await createDownload(themeA._id.toString(), versionA._id.toString(), RECENT);
    }
    await createDownload(themeB._id.toString(), versionB._id.toString(), RECENT);
    for (let index = 0; index < 4; index += 1) {
      await createDownload(themeB._id.toString(), versionB._id.toString(), OLD);
    }

    const recent = await getDashboard("30d");
    const all = await getDashboard("all");

    expect(recent.topThemesByDownloads).toEqual([
      { themeId: themeA._id.toString(), themeName: "Theme A", count: 3 },
      { themeId: themeB._id.toString(), themeName: "Theme B", count: 1 },
    ]);
    expect(all.topThemesByDownloads).toEqual([
      { themeId: themeB._id.toString(), themeName: "Theme B", count: 5 },
      { themeId: themeA._id.toString(), themeName: "Theme A", count: 3 },
    ]);
  });

  it("reports what is waiting", async () => {
    setTestNow(NOW);
    await createWalletPayment({ status: "submitted" });
    await createWalletPayment({ status: "submitted" });
    await createWalletPayment({ status: "approved" });
    const customer = await createUser();
    const customerId = customer._id.toString();
    for (let index = 0; index < 3; index += 1) await createFeedback(customerId, { status: "new" });
    await createFeedback(customerId, { status: "read" });

    const dashboard = await getDashboard("30d");

    expect(dashboard.walletPaymentsToReview).toBe(2);
    expect(dashboard.newFeedbackCount).toBe(3);
  });

  it("returns the newest 20 activity rows", async () => {
    setTestNow(NOW);
    for (let index = 0; index < 25; index += 1) {
      await createActivityLog({
        summary: `Row ${index}`,
        createdAt: new Date(Date.UTC(2026, 9, 1, 0, index)),
      });
    }

    const dashboard = await getDashboard("30d");

    expect(dashboard.latestActivity).toHaveLength(20);
    expect(dashboard.latestActivity[0]?.summary).toBe("Row 24");
    expect(dashboard.latestActivity[19]?.summary).toBe("Row 5");
    expect(dashboard.latestActivity[0]?.createdAt).toEqual(new Date(Date.UTC(2026, 9, 1, 0, 24)));
  });

  it("returns zeros and empty lists on an empty database", async () => {
    setTestNow(NOW);

    const dashboard = await getDashboard("30d");

    const zeroRows = (["today", "last7days", "last30days", "allTime"] as const).map((period) => ({
      period,
      orders: 0,
      revenueAmount: 0,
    }));
    expect(dashboard.sales).toEqual({ usd: zeroRows, egp: zeroRows });
    expect(dashboard.topThemesBySales).toEqual([]);
    expect(dashboard.topThemesByDownloads).toEqual([]);
    expect(dashboard.latestActivity).toEqual([]);
    expect(dashboard.walletPaymentsToReview).toBe(0);
    expect(dashboard.newFeedbackCount).toBe(0);
  });
});

describe("dashboardSearchParamsSchema", () => {
  it("falls back to 30d for a bad range", () => {
    expect(dashboardSearchParamsSchema.parse({ range: "abc" }).range).toBe("30d");
    expect(dashboardSearchParamsSchema.parse({}).range).toBe("30d");
    expect(dashboardSearchParamsSchema.parse({ range: "all" }).range).toBe("all");
  });
});
