import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Pagination } from "@/shared/ui/Pagination";
import { Text } from "@/shared/ui/Text";
import { requireUser } from "@/features/auth/session";
import { OrderTable } from "@/features/orders/components/OrderTable";
import { orderListSearchParamsSchema } from "@/features/orders/order.schemas";
import { listOrdersForUser } from "@/features/orders/order.service";
import { WalletPaymentTable } from "@/features/wallet-payments/components/WalletPaymentTable";
import { listWalletPaymentsForUser } from "@/features/wallet-payments/wallet-payment.service";

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
  const [orders, walletPayments] = await Promise.all([
    listOrdersForUser(user.id, page),
    listWalletPaymentsForUser(user.id),
  ]);

  return (
    <Stack>
      <Heading level={1}>Orders</Heading>
      {orders.items.length === 0 ? <Text>No orders yet.</Text> : <OrderTable orders={orders.items} />}
      <Pagination
        page={orders.page}
        totalPages={orders.totalPages}
        buildHref={(pageNumber) => `/account/orders?page=${pageNumber}`}
      />
      {walletPayments.length === 0 ? null : (
        <>
          <Heading level={2}>Wallet payments</Heading>
          <WalletPaymentTable payments={walletPayments} />
        </>
      )}
    </Stack>
  );
}
