import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { formatPrice } from "@/shared/lib/money";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import type { CouponQuote } from "@/features/coupons/coupon.types";
import type { CheckoutThemeDTO } from "@/features/payments/checkout.types";

type CheckoutSummaryProps = {
  theme: CheckoutThemeDTO;
  quote: CouponQuote | null;
  finalPriceCents: number;
};

export function CheckoutSummary({ theme, quote, finalPriceCents }: CheckoutSummaryProps) {
  return (
    <Stack>
      <Heading level={2}>{theme.name}</Heading>
      <Text tone="muted">{theme.tagline}</Text>
      <Inline justify="between">
        <Text>Price</Text>
        <Text>{formatPrice(theme.priceCents, "usd")}</Text>
      </Inline>
      {quote ? (
        <Inline justify="between">
          <Text>{`Coupon ${quote.code}`}</Text>
          <Text>{`−${formatPrice(quote.discountCents, "usd")}`}</Text>
        </Inline>
      ) : null}
      <Inline justify="between">
        <Text weight="bold">Total</Text>
        <Text weight="bold">{formatPrice(finalPriceCents, "usd")}</Text>
      </Inline>
    </Stack>
  );
}
