import { formatPrice } from "@/shared/lib/money";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { CUSTOMER_MESSAGES } from "@/features/users/user.constants";
import type { CustomerWalletRowDTO } from "@/features/users/user.types";
import { WALLET_STATUS_LABELS } from "@/features/wallet-payments/wallet-payment.constants";

type CustomerWalletSectionProps = {
  payments: CustomerWalletRowDTO[];
};

const PIASTERS_PER_POUND = 100;

export function CustomerWalletSection({ payments }: CustomerWalletSectionProps) {
  if (payments.length === 0) return <Text>{CUSTOMER_MESSAGES.noWalletPayments}</Text>;
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Reference</TableHeaderCell>
          <TableHeaderCell>Theme</TableHeaderCell>
          <TableHeaderCell>Amount</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{payment.referenceCode}</TableCell>
            <TableCell>{payment.themeName}</TableCell>
            <TableCell>{formatPrice(payment.amountEgp * PIASTERS_PER_POUND, "egp")}</TableCell>
            <TableCell>{WALLET_STATUS_LABELS[payment.status]}</TableCell>
            <TableCell>
              <TextLink href={`/admin/wallet-payments/${payment.id}`}>Review</TextLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
