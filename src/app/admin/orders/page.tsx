import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Pagination } from "@/shared/ui/Pagination";
import { Text } from "@/shared/ui/Text";
import { requireAdmin } from "@/features/auth/session";
import { OrderFilters } from "@/features/orders/components/admin/OrderFilters";
import { OrderTable } from "@/features/orders/components/admin/OrderTable";
import { adminOrderSearchParamsSchema } from "@/features/orders/order-admin.schemas";
import { listOrdersForAdmin } from "@/features/orders/order-admin.service";

export const metadata: Metadata = {
  title: "Orders · Theme Store",
  robots: { index: false },
};

type AdminOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Filters = ReturnType<typeof adminOrderSearchParamsSchema.parse>;

function buildHref(filters: Filters, page: number): string {
  const params = new URLSearchParams();
  if (filters.method) params.set("method", filters.method);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/orders?${query}` : "/admin/orders";
}

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  await requireAdmin();
  const filters = adminOrderSearchParamsSchema.parse(await searchParams);
  const result = await listOrdersForAdmin(filters);

  return (
    <Stack>
      <Heading level={1}>Orders</Heading>
      <OrderFilters method={filters.method} status={filters.status} from={filters.from} to={filters.to} />
      {result.items.length > 0 ? <OrderTable orders={result.items} /> : <Text>No orders found.</Text>}
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        buildHref={(targetPage) => buildHref(filters, targetPage)}
      />
    </Stack>
  );
}
