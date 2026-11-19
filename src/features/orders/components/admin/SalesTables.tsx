import { formatPrice } from "@/shared/lib/money";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { SALES_PERIOD_LABELS } from "@/features/orders/dashboard.constants";
import type { SalesRowDTO } from "@/features/orders/dashboard.types";
import type { OrderCurrency } from "@/features/orders/order.constants";

type SalesTablesProps = {
  sales: { usd: SalesRowDTO[]; egp: SalesRowDTO[] };
};

type SalesTableProps = {
  title: string;
  currency: OrderCurrency;
  rows: SalesRowDTO[];
};

function SalesTable({ title, currency, rows }: SalesTableProps) {
  return (
    <Stack>
      <Heading level={2}>{title}</Heading>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Period</TableHeaderCell>
            <TableHeaderCell>Orders</TableHeaderCell>
            <TableHeaderCell>Revenue</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.period}>
              <TableCell>{SALES_PERIOD_LABELS[row.period]}</TableCell>
              <TableCell>{row.orders}</TableCell>
              <TableCell>{formatPrice(row.revenueAmount, currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}

export function SalesTables({ sales }: SalesTablesProps) {
  return (
    <Stack gap="lg">
      <SalesTable title="Sales in USD (card)" currency="usd" rows={sales.usd} />
      <SalesTable title="Sales in EGP (wallet)" currency="egp" rows={sales.egp} />
    </Stack>
  );
}
