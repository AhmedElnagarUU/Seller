import { now } from "@/shared/lib/clock";
import { listActivity } from "@/features/activity/activity.service";
import { getTopThemesByDownloads } from "@/features/downloads/download.service";
import { countNewFeedback } from "@/features/feedback/feedback.service";
import {
  LATEST_ACTIVITY_COUNT,
  SALES_PERIODS,
  TOP_THEMES_LIMIT,
  type DashboardRange,
  type SalesPeriod,
} from "@/features/orders/dashboard.constants";
import type { DashboardDTO, SalesRowDTO, TopThemeDTO } from "@/features/orders/dashboard.types";
import type { OrderCurrency } from "@/features/orders/order.constants";
import * as orderRepository from "@/features/orders/order.repository";
import { listThemeOptionsForAdmin } from "@/features/themes/theme.service";
import { countSubmittedWalletPayments } from "@/features/wallet-payments/wallet-payment-review.service";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;

function daysAgo(moment: Date, days: number): Date {
  return new Date(moment.getTime() - days * MILLISECONDS_PER_DAY);
}

// Where each period starts (inclusive, UTC). "Today" starts at 00:00 UTC of today; the rest count back from now.
function periodStart(period: SalesPeriod, moment: Date): Date | null {
  if (period === "today") {
    return new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate()));
  }
  if (period === "last7days") return daysAgo(moment, DAYS_PER_WEEK);
  if (period === "last30days") return daysAgo(moment, DAYS_PER_MONTH);
  return null;
}

async function loadSalesRows(currency: OrderCurrency, moment: Date): Promise<SalesRowDTO[]> {
  return Promise.all(
    SALES_PERIODS.map(async (period) => {
      const sums = await orderRepository.sumSales(currency, periodStart(period, moment));
      return { period, orders: sums.orders, revenueAmount: sums.revenueAmount };
    }),
  );
}

function withThemeNames(rows: { themeId: string; count: number }[], themeNames: Map<string, string>): TopThemeDTO[] {
  const result: TopThemeDTO[] = [];
  for (const row of rows) {
    const themeName = themeNames.get(row.themeId);
    if (themeName !== undefined) result.push({ themeId: row.themeId, themeName, count: row.count });
  }
  return result;
}

// Everything the admin dashboard shows. The two currencies stay in separate lists.
export async function getDashboard(range: DashboardRange): Promise<DashboardDTO> {
  const moment = now();
  const since = range === "30d" ? daysAgo(moment, DAYS_PER_MONTH) : null;
  const [usd, egp, bySales, byDownloads, themes, walletPaymentsToReview, newFeedbackCount, activity] =
    await Promise.all([
      loadSalesRows("usd", moment),
      loadSalesRows("egp", moment),
      orderRepository.topThemesBySales(since, TOP_THEMES_LIMIT),
      getTopThemesByDownloads(since, TOP_THEMES_LIMIT),
      listThemeOptionsForAdmin(),
      countSubmittedWalletPayments(),
      countNewFeedback(),
      listActivity({ page: 1 }),
    ]);
  const themeNames = new Map(themes.map((theme) => [theme.id, theme.name]));
  return {
    sales: { usd, egp },
    range,
    topThemesBySales: withThemeNames(bySales, themeNames),
    topThemesByDownloads: withThemeNames(byDownloads, themeNames),
    walletPaymentsToReview,
    newFeedbackCount,
    latestActivity: activity.items
      .slice(0, LATEST_ACTIVITY_COUNT)
      .map((row) => ({ id: row.id, createdAt: row.createdAt, summary: row.summary })),
  };
}
