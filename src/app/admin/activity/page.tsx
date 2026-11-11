import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Pagination } from "@/shared/ui/Pagination";
import { Text } from "@/shared/ui/Text";
import { ActivityFilters } from "@/features/activity/components/admin/ActivityFilters";
import { ActivityTable } from "@/features/activity/components/admin/ActivityTable";
import type { ActivityAction } from "@/features/activity/activity.constants";
import { activitySearchParamsSchema } from "@/features/activity/activity.schemas";
import { listActivity } from "@/features/activity/activity.service";
import { requireAdmin } from "@/features/auth/session";

export const metadata: Metadata = {
  title: "Activity · Theme Store",
  robots: { index: false },
};

type AdminActivityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildHref(action: ActivityAction | undefined, customer: string, page: number): string {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (customer) params.set("customer", customer);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/activity?${query}` : "/admin/activity";
}

export default async function AdminActivityPage({ searchParams }: AdminActivityPageProps) {
  await requireAdmin();
  const { action, customer, page } = activitySearchParamsSchema.parse(await searchParams);
  const result = await listActivity({ action, customerEmail: customer, page });

  return (
    <Stack>
      <Heading level={1}>Activity</Heading>
      <ActivityFilters action={action} customer={customer} />
      {result.items.length > 0 ? <ActivityTable entries={result.items} /> : <Text>No activity found.</Text>}
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        buildHref={(targetPage) => buildHref(action, customer, targetPage)}
      />
    </Stack>
  );
}
