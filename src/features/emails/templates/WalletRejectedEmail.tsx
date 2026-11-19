import { Button, Section, Text } from "@react-email/components";
import { env } from "@/shared/config/env";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/features/emails/templates/EmailLayout";
import type { WalletPaymentEmailData } from "@/features/wallet-payments/wallet-payment.types";

type WalletRejectedEmailProps = {
  data: WalletPaymentEmailData;
};

export function WalletRejectedEmail({ data }: WalletRejectedEmailProps) {
  return (
    <EmailLayout preview={`We could not confirm your payment for ${data.themeName}.`}>
      <Text style={EMAIL_PARAGRAPH_STYLE}>{`Hi ${data.userName},`}</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        We could not confirm your wallet payment for <strong>{data.themeName}</strong>
        {` (reference ${data.referenceCode}).`}
      </Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>{`Reason: ${data.rejectionReason ?? ""}`}</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        If you already sent the money, reply to this email with your transfer details and we will help you.
      </Text>
      <Section>
        <Button href={`${env.APP_URL}/account/wallet-payments/${data.id}`} style={EMAIL_BUTTON_STYLE}>
          View payment
        </Button>
      </Section>
    </EmailLayout>
  );
}
