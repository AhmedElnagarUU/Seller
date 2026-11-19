import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Heading } from "@/shared/ui/Heading";
import { requireAdmin } from "@/features/auth/session";
import { WalletReviewPanel } from "@/features/wallet-payments/components/admin/WalletReviewPanel";
import { WALLET_STATUS_LABELS, WALLET_STATUS_TONES } from "@/features/wallet-payments/wallet-payment.constants";
import { getWalletPaymentForAdmin } from "@/features/wallet-payments/wallet-payment-review.service";

export const metadata: Metadata = {
  title: "Wallet payment · Theme Store",
  robots: { index: false },
};

type AdminWalletPaymentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminWalletPaymentPage({ params }: AdminWalletPaymentPageProps) {
  await requireAdmin();
  const { id } = await params;
  const payment = await getWalletPaymentForAdmin(id);
  if (!payment) notFound();

  return (
    <Stack gap="lg">
      <Inline>
        <Heading level={1}>{`Wallet payment ${payment.referenceCode}`}</Heading>
        <Badge tone={WALLET_STATUS_TONES[payment.status]}>{WALLET_STATUS_LABELS[payment.status]}</Badge>
      </Inline>
      <WalletReviewPanel payment={payment} />
    </Stack>
  );
}
