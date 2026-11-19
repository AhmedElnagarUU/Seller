import { Button, Section, Text } from "@react-email/components";
import { env } from "@/shared/config/env";
import { formatPrice } from "@/shared/lib/money";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/features/emails/templates/EmailLayout";
import type { WalletPaymentEmailData } from "@/features/wallet-payments/wallet-payment.types";

const PIASTERS_PER_POUND = 100;

type WalletApprovedEmailProps = {
  data: WalletPaymentEmailData;
};

export function WalletApprovedEmail({ data }: WalletApprovedEmailProps) {
  const amount = formatPrice(data.amountEgp * PIASTERS_PER_POUND, "egp");
  return (
    <EmailLayout preview={`Your payment for ${data.themeName} was approved.`}>
      <Text style={EMAIL_PARAGRAPH_STYLE}>{`Hi ${data.userName},`}</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        We received your payment of <strong>{amount}</strong>
        {` (reference ${data.referenceCode}). `}
        <strong>{data.themeName}</strong> is now yours, with free updates for life.
      </Text>
      <Section>
        <Button href={env.APP_URL + "/account/themes"} style={EMAIL_BUTTON_STYLE}>
          Download your theme
        </Button>
      </Section>
    </EmailLayout>
  );
}
