import { formatDate } from "@/shared/lib/dates";
import { formatPrice } from "@/shared/lib/money";
import { Stack } from "@/shared/layout/Stack";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import type { WalletPaymentAdminListItemDTO } from "@/features/wallet-payments/wallet-payment.types";

const PIASTERS_PER_POUND = 100;

type WalletPaymentAdminTableProps = {
  payments: WalletPaymentAdminListItemDTO[];
};

// The customer is plain text: the customer pages come with a later task.
export function WalletPaymentAdminTable({ payments }: WalletPaymentAdminTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Submitted</TableHeaderCell>
          <TableHeaderCell>Customer</TableHeaderCell>
          <TableHeaderCell>Theme</TableHeaderCell>
          <TableHeaderCell>Amount</TableHeaderCell>
          <TableHeaderCell>Reference</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{payment.submittedAt ? formatDate(payment.submittedAt) : "—"}</TableCell>
            <TableCell>
              <Stack gap="xs">
                <Text>{payment.customerName}</Text>
                <Text size="sm" tone="muted">
                  {payment.customerEmail}
                </Text>
              </Stack>
            </TableCell>
            <TableCell>{payment.themeName}</TableCell>
            <TableCell>{formatPrice(payment.amountEgp * PIASTERS_PER_POUND, "egp")}</TableCell>
            <TableCell>{payment.referenceCode}</TableCell>
            <TableCell>
              <TextLink href={`/admin/wallet-payments/${payment.id}`}>Review</TextLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
