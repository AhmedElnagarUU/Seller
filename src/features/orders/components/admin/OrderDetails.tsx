import { formatDate } from "@/shared/lib/dates";
import { formatPrice } from "@/shared/lib/money";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Card } from "@/shared/ui/Card";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { ORDER_METHOD_LABELS, PROVIDER_LABELS } from "@/features/orders/order.constants";
import type { AdminOrderDTO } from "@/features/orders/order-admin.types";

type OrderDetailsProps = {
  order: AdminOrderDTO;
};

type LineProps = {
  label: string;
  children: React.ReactNode;
};

function Line({ label, children }: LineProps) {
  return (
    <Inline gap="sm" wrap>
      <Text weight="bold">{label}</Text>
      {children}
    </Inline>
  );
}

function TextValue({ value }: { value: string }) {
  return <Text>{value}</Text>;
}

export function OrderDetails({ order }: OrderDetailsProps) {
  const money = (amount: number) => formatPrice(amount, order.currency);
  return (
    <Card>
      <Stack gap="sm">
        <Line label="Customer">
          <TextLink href={`/admin/customers/${order.customer.id}`}>{order.customer.name}</TextLink>
          <TextValue value={order.customer.email} />
        </Line>
        <Line label="Theme">
          <TextLink href={`/admin/themes/${order.theme.id}`}>{order.theme.name}</TextLink>
        </Line>
        <Line label="Method">
          <TextValue value={ORDER_METHOD_LABELS[order.method]} />
        </Line>
        <Line label="Subtotal">
          <TextValue value={money(order.subtotalAmount)} />
        </Line>
        <Line label="Discount">
          <TextValue value={money(order.discountAmount)} />
          {order.couponCode ? <TextValue value={`Coupon: ${order.couponCode}`} /> : null}
        </Line>
        <Line label="Tax">
          <TextValue value={money(order.taxAmount)} />
        </Line>
        <Line label="Total">
          <TextValue value={money(order.totalAmount)} />
        </Line>
        <Line label="Refunded amount">
          <TextValue value={money(order.refundedAmount)} />
        </Line>
        <Line label="Paid on">
          <TextValue value={formatDate(order.paidAt)} />
        </Line>
        {order.refundedAt ? (
          <Line label="Refunded on">
            <TextValue value={formatDate(order.refundedAt)} />
          </Line>
        ) : null}
        <Line label="Payment provider">
          <TextValue value={PROVIDER_LABELS[order.provider.name]} />
        </Line>
        <Line label="Provider order id">
          <TextValue value={order.provider.orderId} />
        </Line>
        {order.provider.checkoutId ? (
          <Line label="Checkout id">
            <TextValue value={order.provider.checkoutId} />
          </Line>
        ) : null}
        {order.provider.customerId ? (
          <Line label="Provider customer id">
            <TextValue value={order.provider.customerId} />
          </Line>
        ) : null}
        {order.walletPaymentId ? (
          <TextLink href={`/admin/wallet-payments/${order.walletPaymentId}`}>View wallet payment</TextLink>
        ) : null}
      </Stack>
    </Card>
  );
}
