export const DASHBOARD_RANGES = ["30d", "all"] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];
export const DEFAULT_DASHBOARD_RANGE: DashboardRange = "30d";
export const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = { "30d": "30 days", all: "All time" };

export const SALES_PERIODS = ["today", "last7days", "last30days", "allTime"] as const;
export type SalesPeriod = (typeof SALES_PERIODS)[number];
export const SALES_PERIOD_LABELS = {
  today: "Today",
  last7days: "7 days",
  last30days: "30 days",
  allTime: "All time",
} as const satisfies Record<SalesPeriod, string>;

export const TOP_THEMES_LIMIT = 5;
export const LATEST_ACTIVITY_COUNT = 20;

export const DASHBOARD_MESSAGES = {
  noTopThemes: "Nothing yet.",
  noActivity: "No activity yet.",
} as const;
