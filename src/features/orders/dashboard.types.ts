import type { DashboardRange, SalesPeriod } from "@/features/orders/dashboard.constants";

export type SalesRowDTO = { period: SalesPeriod; orders: number; revenueAmount: number };

export type TopThemeDTO = { themeId: string; themeName: string; count: number };

export type DashboardDTO = {
  // Four rows each, in the order of SALES_PERIODS. The currencies are never added together (D-124).
  sales: { usd: SalesRowDTO[]; egp: SalesRowDTO[] };
  range: DashboardRange;
  topThemesBySales: TopThemeDTO[];
  topThemesByDownloads: TopThemeDTO[];
  walletPaymentsToReview: number;
  newFeedbackCount: number;
  latestActivity: { id: string; createdAt: Date; summary: string }[];
};
