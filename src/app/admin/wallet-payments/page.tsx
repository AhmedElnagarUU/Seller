import type { Metadata } from "next";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Heading } from "@/shared/ui/Heading";
import { Pagination } from "@/shared/ui/Pagination";
import { Text } from "@/shared/ui/Text";
import { requireAdmin } from "@/features/auth/session";
import { WalletPaymentAdminTable } from "@/features/wallet-payments/components/admin/WalletPaymentAdminTable";
import { WALLET_TAB_LABELS, WALLET_TABS, type WalletTab } from "@/features/wallet-payments/wallet-payment.constants";
import { walletPaymentsSearchParamsSchema } from "@/features/wallet-payments/wallet-payment.schemas";
import { listWalletPaymentsForAdmin } from "@/features/wallet-payments/wallet-payment-review.service";

export const metadata: Metadata = {
  title: "Wallet payments · Theme Store",
  robots: { index: false },
};

type AdminWalletPaymentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildHref(tab: WalletTab, page: number): string {
  const params = new URLSearchParams({ tab });
  if (page > 1) params.set("page", String(page));
  return `/admin/wallet-payments?${params.toString()}`;
}

const TAB_KEYS = Object.keys(WALLET_TABS) as WalletTab[];

export default async function AdminWalletPaymentsPage({ searchParams }: AdminWalletPaymentsPageProps) {
  await requireAdmin();
  const { tab, page } = walletPaymentsSearchParamsSchema.parse(await searchParams);
  const result = await listWalletPaymentsForAdmin({ tab, page });

  return (
    <Stack>
      <Heading level={1}>Wallet payments</Heading>
      <Inline gap="sm" wrap>
        {TAB_KEYS.map((key) => (
          <ButtonLink key={key} href={buildHref(key, 1)} size="sm" variant={key === tab ? "primary" : "secondary"}>
            {WALLET_TAB_LABELS[key]}
          </ButtonLink>
        ))}
      </Inline>
      {result.items.length > 0 ? <WalletPaymentAdminTable payments={result.items} /> : <Text>No payments here.</Text>}
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        buildHref={(targetPage) => buildHref(tab, targetPage)}
      />
    </Stack>
  );
}
