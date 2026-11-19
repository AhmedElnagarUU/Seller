import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Pagination } from "@/shared/ui/Pagination";
import { Text } from "@/shared/ui/Text";
import { requireUser } from "@/features/auth/session";
import { OrderTable } from "@/features/orders/components/OrderTable";
import { orderListSearchParamsSchema } from "@/features/orders/order.schemas";
import { listOrdersForUser } from "@/features/orders/order.service";

export const metadata: Metadata = {
  title: "Orders · Theme Store",
  robots: { index: false },
};

type AccountOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountOrdersPage({ searchParams }: AccountOrdersPageProps) {
  const user = await requireUser("/account/orders");
  const { page } = orderListSearchParamsSchema.parse(await searchParams);
  const orders = await listOrdersForUser(user.id, page);

  return (
    <Stack>
      <Heading level={1}>Orders</Heading>
      {orders.items.length === 0 ? <Text>No orders yet.</Text> : <OrderTable orders={orders.items} />}
      <Pagination
        page={orders.page}
        totalPages={orders.totalPages}
        buildHref={(pageNumber) => `/account/orders?page=${pageNumber}`}
      />
    </Stack>
  );
}
