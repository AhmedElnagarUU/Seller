import { formatDate } from "@/shared/lib/dates";
import { formatPrice } from "@/shared/lib/money";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { Text } from "@/shared/ui/Text";
import { ORDER_METHOD_LABELS, ORDER_STATUS_LABELS } from "@/features/orders/order.constants";
import { CUSTOMER_MESSAGES } from "@/features/users/user.constants";
import type { CustomerOrderRowDTO } from "@/features/users/user.types";

type CustomerOrdersSectionProps = {
  orders: CustomerOrderRowDTO[];
};

export function CustomerOrdersSection({ orders }: CustomerOrdersSectionProps) {
  if (orders.length === 0) return <Text>{CUSTOMER_MESSAGES.noOrders}</Text>;
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Theme</TableHeaderCell>
          <TableHeaderCell>Method</TableHeaderCell>
          <TableHeaderCell>Total</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>{formatDate(order.paidAt)}</TableCell>
            <TableCell>{order.themeName}</TableCell>
            <TableCell>{ORDER_METHOD_LABELS[order.method]}</TableCell>
            <TableCell>{formatPrice(order.totalAmount, order.currency)}</TableCell>
            <TableCell>{ORDER_STATUS_LABELS[order.status]}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
