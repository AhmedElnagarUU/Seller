import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { requireAdmin } from "@/features/auth/session";
import { dashboardSearchParamsSchema } from "@/features/orders/dashboard.schemas";
import { getDashboard } from "@/features/orders/dashboard.service";
import { LatestActivity } from "@/features/orders/components/admin/LatestActivity";
import { SalesTables } from "@/features/orders/components/admin/SalesTables";
import { TopThemesLists } from "@/features/orders/components/admin/TopThemesLists";
import { WaitingForYou } from "@/features/orders/components/admin/WaitingForYou";

export const metadata: Metadata = {
  title: "Dashboard · Theme Store",
  robots: { index: false },
};

type AdminDashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  await requireAdmin();
  const { range } = dashboardSearchParamsSchema.parse(await searchParams);
  const dashboard = await getDashboard(range);

  return (
    <Stack gap="lg">
      <Heading level={1}>Dashboard</Heading>
      <SalesTables sales={dashboard.sales} />
      <TopThemesLists
        range={dashboard.range}
        bySales={dashboard.topThemesBySales}
        byDownloads={dashboard.topThemesByDownloads}
      />
      <WaitingForYou
        walletPaymentsToReview={dashboard.walletPaymentsToReview}
        newFeedbackCount={dashboard.newFeedbackCount}
      />
      <LatestActivity activity={dashboard.latestActivity} />
    </Stack>
  );
}
