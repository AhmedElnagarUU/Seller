"use client";

import { useActionState } from "react";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { formatPrice } from "@/shared/lib/money";
import { FormError } from "@/shared/ui/FormError";
import { Heading } from "@/shared/ui/Heading";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { Text } from "@/shared/ui/Text";
import { simulateFakePaymentAction } from "@/features/payments/checkout.actions";
import type { FakeCheckoutDTO } from "@/features/payments/checkout.types";

type FakeCheckoutFormProps = {
  checkoutId: string;
  themeId: string;
  couponId: string;
  data: FakeCheckoutDTO;
};

export function FakeCheckoutForm({ checkoutId, themeId, couponId, data }: FakeCheckoutFormProps) {
  const [state, formAction] = useActionState(simulateFakePaymentAction, null);

  return (
    <form action={formAction}>
      <Stack>
        <Heading level={1}>Fake checkout (test mode)</Heading>
        <Heading level={2}>{data.themeName}</Heading>
        <Inline justify="between">
          <Text>Price</Text>
          <Text>{formatPrice(data.subtotalCents, "usd")}</Text>
        </Inline>
        {data.couponCode ? (
          <Inline justify="between">
            <Text>{`Coupon ${data.couponCode}`}</Text>
            <Text>{`−${formatPrice(data.discountCents, "usd")}`}</Text>
          </Inline>
        ) : null}
        <Inline justify="between">
          <Text weight="bold">Total</Text>
          <Text weight="bold">{formatPrice(data.totalCents, "usd")}</Text>
        </Inline>
        <input type="hidden" name="checkoutId" value={checkoutId} />
        <input type="hidden" name="themeId" value={themeId} />
        <input type="hidden" name="couponId" value={couponId} />
        <FormError message={state?.ok === false ? state.error : null} />
        <SubmitButton pendingText="Processing…">Simulate successful payment</SubmitButton>
      </Stack>
    </form>
  );
}
