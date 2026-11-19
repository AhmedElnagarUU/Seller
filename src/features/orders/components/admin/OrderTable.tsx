import { formatDate } from "@/shared/lib/dates";
import { formatPrice } from "@/shared/lib/money";
import { Badge } from "@/shared/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { TextLink } from "@/shared/ui/TextLink";
import { ORDER_METHOD_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "@/features/orders/order.constants";
import type { AdminOrderListItemDTO } from "@/features/orders/order-admin.types";

type AdminOrderTableProps = {
  orders: AdminOrderListItemDTO[];
};

export function OrderTable({ orders }: AdminOrderTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Customer</TableHeaderCell>
          <TableHeaderCell>Theme</TableHeaderCell>
          <TableHeaderCell>Method</TableHeaderCell>
          <TableHeaderCell>Total</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Order</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>{formatDate(order.paidAt)}</TableCell>
            <TableCell>
              <TextLink href={`/admin/customers/${order.customerId}`}>{order.customerName}</TextLink>
            </TableCell>
            <TableCell>{order.themeName}</TableCell>
            <TableCell>{ORDER_METHOD_LABELS[order.method]}</TableCell>
            <TableCell>{formatPrice(order.totalAmount, order.currency)}</TableCell>
            <TableCell>
              <Badge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
            </TableCell>
            <TableCell>
              <TextLink href={`/admin/orders/${order.id}`}>View</TextLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
