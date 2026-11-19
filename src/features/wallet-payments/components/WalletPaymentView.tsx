import { formatPrice } from "@/shared/lib/money";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { DownloadButton } from "@/features/downloads/components/DownloadButton";
import { CopyReferenceButton } from "@/features/wallet-payments/components/CopyReferenceButton";
import { WalletCancelButton } from "@/features/wallet-payments/components/WalletCancelButton";
import { WalletInstructions } from "@/features/wallet-payments/components/WalletInstructions";
import { WalletProofForm } from "@/features/wallet-payments/components/WalletProofForm";
import type { WalletAccountDTO, WalletPaymentDTO } from "@/features/wallet-payments/wallet-payment.types";

const PIASTERS_PER_POUND = 100;

type WalletPaymentViewProps = {
  payment: WalletPaymentDTO;
  accounts: WalletAccountDTO[];
  latestVersion: { id: string; version: string } | null;
};

type PartProps = { payment: WalletPaymentDTO };

function AwaitingPayment({ payment, accounts }: PartProps & { accounts: WalletAccountDTO[] }) {
  const amount = formatPrice(payment.amountEgp * PIASTERS_PER_POUND, "egp");
  return (
    <Stack>
      <Text size="lg" weight="bold">
        {amount}
      </Text>
      <Inline gap="sm">
        <Text>{`Reference: ${payment.referenceCode}`}</Text>
        <CopyReferenceButton referenceCode={payment.referenceCode} />
      </Inline>
      <WalletInstructions accounts={accounts} />
      <Stack gap="xs">
        <Text>{`1. Send exactly ${amount}.`}</Text>
        <Text>{`2. Write ${payment.referenceCode} in the transfer note.`}</Text>
        <Text>3. Upload the screenshot below.</Text>
      </Stack>
      <WalletProofForm walletPaymentId={payment.id} />
      <WalletCancelButton walletPaymentId={payment.id} />
    </Stack>
  );
}

function Submitted({ payment }: PartProps) {
  return (
    <Stack gap="sm">
      <Text>We received your payment details. We&apos;ll review them within 24 hours and notify you.</Text>
      <Text>{`Reference: ${payment.referenceCode}`}</Text>
      <Text>{`Amount: ${formatPrice(payment.amountEgp * PIASTERS_PER_POUND, "egp")}`}</Text>
      <Text>{`Phone: ${payment.senderPhone ?? ""}`}</Text>
      {payment.transactionId ? <Text>{`Transaction ID: ${payment.transactionId}`}</Text> : null}
    </Stack>
  );
}

function Approved({ payment, latestVersion }: PartProps & Pick<WalletPaymentViewProps, "latestVersion">) {
  return (
    <Stack align="start">
      <Text>{`Payment approved. ${payment.themeName} is yours.`}</Text>
      {latestVersion ? (
        <DownloadButton versionId={latestVersion.id} label={`Download ${latestVersion.version}`} />
      ) : null}
      <TextLink href="/account/themes">My themes</TextLink>
    </Stack>
  );
}

function Rejected({ payment }: PartProps) {
  return (
    <Stack align="start">
      <Alert tone="danger">{payment.rejectionReason ?? ""}</Alert>
      <ButtonLink href={`/checkout/${payment.themeSlug}`}>Start a new payment</ButtonLink>
    </Stack>
  );
}

function Cancelled({ payment }: PartProps) {
  return (
    <Stack align="start">
      <Text>This payment was cancelled.</Text>
      <TextLink href={`/themes/${payment.themeSlug}`}>{`Back to ${payment.themeName}`}</TextLink>
    </Stack>
  );
}

// What the payment page shows for each status (docs/06-payments.md section 7.4).
export function WalletPaymentView({ payment, accounts, latestVersion }: WalletPaymentViewProps) {
  if (payment.status === "awaiting_payment") return <AwaitingPayment payment={payment} accounts={accounts} />;
  if (payment.status === "submitted") return <Submitted payment={payment} />;
  if (payment.status === "approved") return <Approved payment={payment} latestVersion={latestVersion} />;
  if (payment.status === "rejected") return <Rejected payment={payment} />;
  return <Cancelled payment={payment} />;
}
