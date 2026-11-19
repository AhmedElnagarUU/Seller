import { formatPrice } from "@/shared/lib/money";
import { Badge } from "@/shared/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { TextLink } from "@/shared/ui/TextLink";
import { WALLET_STATUS_LABELS, WALLET_STATUS_TONES } from "@/features/wallet-payments/wallet-payment.constants";
import type { WalletPaymentListItemDTO } from "@/features/wallet-payments/wallet-payment.types";

const PIASTERS_PER_POUND = 100;

type WalletPaymentTableProps = {
  payments: WalletPaymentListItemDTO[];
};

export function WalletPaymentTable({ payments }: WalletPaymentTableProps) {
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
            <TableCell>
              <Badge tone={WALLET_STATUS_TONES[payment.status]}>{WALLET_STATUS_LABELS[payment.status]}</Badge>
            </TableCell>
            <TableCell>
              <TextLink href={`/account/wallet-payments/${payment.id}`}>View</TextLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
