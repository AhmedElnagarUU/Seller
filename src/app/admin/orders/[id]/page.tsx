import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Heading } from "@/shared/ui/Heading";
import { requireAdmin } from "@/features/auth/session";
import { MarkRefundedButton } from "@/features/orders/components/admin/MarkRefundedButton";
import { OrderDetails } from "@/features/orders/components/admin/OrderDetails";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "@/features/orders/order.constants";
import { getOrderForAdmin } from "@/features/orders/order-admin.service";

export const metadata: Metadata = {
  title: "Order · Theme Store",
  robots: { index: false },
};

type AdminOrderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrderPage({ params }: AdminOrderPageProps) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderForAdmin(id);
  if (!order) notFound();

  return (
    <Stack gap="lg">
      <Inline>
        <Heading level={1}>{`Order ${order.id}`}</Heading>
        <Badge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
      </Inline>
      <OrderDetails order={order} />
      {order.canMarkRefunded ? <MarkRefundedButton orderId={order.id} /> : null}
    </Stack>
  );
}
