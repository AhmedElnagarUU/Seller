import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Heading } from "@/shared/ui/Heading";
import { requireUser } from "@/features/auth/session";
import { listVersionsForTheme } from "@/features/versions/version.service";
import { WalletPaymentView } from "@/features/wallet-payments/components/WalletPaymentView";
import { WALLET_STATUS_LABELS, WALLET_STATUS_TONES } from "@/features/wallet-payments/wallet-payment.constants";
import { getWalletPaymentPageData } from "@/features/wallet-payments/wallet-payment.service";

export const metadata: Metadata = {
  title: "Wallet payment · Theme Store",
  robots: { index: false },
};

type WalletPaymentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function WalletPaymentPage({ params }: WalletPaymentPageProps) {
  const { id } = await params;
  const user = await requireUser("/account/wallet-payments/" + id);
  const data = await getWalletPaymentPageData(user.id, id);
  if (!data) notFound();
  const { payment, accounts } = data;
  const [newestVersion] = payment.status === "approved" ? await listVersionsForTheme(payment.themeId) : [];

  return (
    <PageContainer>
      <Stack>
        <Heading level={1}>Wallet payment</Heading>
        <div>
          <Badge tone={WALLET_STATUS_TONES[payment.status]}>{WALLET_STATUS_LABELS[payment.status]}</Badge>
        </div>
        <WalletPaymentView
          payment={payment}
          accounts={accounts}
          latestVersion={newestVersion ? { id: newestVersion.id, version: newestVersion.version } : null}
        />
      </Stack>
    </PageContainer>
  );
}
