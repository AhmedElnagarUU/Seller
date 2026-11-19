import { formatPrice } from "@/shared/lib/money";
import { Stack } from "@/shared/layout/Stack";
import { Card } from "@/shared/ui/Card";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { CardCheckoutForm } from "@/features/payments/components/CardCheckoutForm";
import type { CheckoutWalletDTO } from "@/features/payments/checkout.types";
import { WalletStartForm } from "@/features/wallet-payments/components/WalletStartForm";

const PIASTERS_PER_POUND = 100;

type PaymentMethodPickerProps = {
  slug: string;
  couponCode: string | null;
  wallet: CheckoutWalletDTO | null;
};

// The ways to pay: always the card, and the Egyptian wallet when the customer can use it.
export function PaymentMethodPicker({ slug, couponCode, wallet }: PaymentMethodPickerProps) {
  return (
    <Stack>
      <Card>
        <Stack>
          <Heading level={3}>Pay by card</Heading>
          <CardCheckoutForm slug={slug} couponCode={couponCode} />
        </Stack>
      </Card>
      {wallet ? (
        <Card>
          <Stack>
            <Heading level={3}>Pay with an Egyptian wallet</Heading>
            <Text>{`You pay ${formatPrice(wallet.amountEgp * PIASTERS_PER_POUND, "egp")}.`}</Text>
            <WalletStartForm slug={slug} couponCode={couponCode} />
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
