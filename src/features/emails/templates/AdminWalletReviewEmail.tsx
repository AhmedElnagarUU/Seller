import { Button, Section, Text } from "@react-email/components";
import { env } from "@/shared/config/env";
import { formatPrice } from "@/shared/lib/money";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/features/emails/templates/EmailLayout";
import type { WalletPaymentEmailData } from "@/features/wallet-payments/wallet-payment.types";

const PIASTERS_PER_POUND = 100;

type AdminWalletReviewEmailProps = {
  data: WalletPaymentEmailData;
};

export function AdminWalletReviewEmail({ data }: AdminWalletReviewEmailProps) {
  const amount = formatPrice(data.amountEgp * PIASTERS_PER_POUND, "egp");
  return (
    <EmailLayout preview={`New wallet payment to review: ${data.referenceCode}`}>
      <Text style={EMAIL_PARAGRAPH_STYLE}>A customer submitted a wallet payment.</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        {`Customer: ${data.userName} (${data.userEmail}) · Theme: ${data.themeName} · Amount: ${amount} · Reference: ${data.referenceCode} · Sender phone: ${data.senderPhone ?? ""}`}
      </Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>Check that the money arrived before approving.</Text>
      <Section>
        <Button href={`${env.APP_URL}/admin/wallet-payments/${data.id}`} style={EMAIL_BUTTON_STYLE}>
          Review payment
        </Button>
      </Section>
    </EmailLayout>
  );
}
