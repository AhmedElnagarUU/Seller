import { formatDate } from "@/shared/lib/dates";
import { formatPrice } from "@/shared/lib/money";
import { Badge } from "@/shared/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { TextLink } from "@/shared/ui/TextLink";
import { ORDER_METHOD_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "@/features/orders/order.constants";
import type { OrderListItemDTO } from "@/features/orders/order.types";

type OrderTableProps = {
  orders: OrderListItemDTO[];
};

export function OrderTable({ orders }: OrderTableProps) {
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
            <TableCell>
              <TextLink href={`/themes/${order.themeSlug}`}>{order.themeName}</TextLink>
            </TableCell>
            <TableCell>{ORDER_METHOD_LABELS[order.method]}</TableCell>
            <TableCell>{formatPrice(order.totalAmount, order.currency)}</TableCell>
            <TableCell>
              <Badge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
