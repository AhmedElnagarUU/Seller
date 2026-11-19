"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { startCardCheckoutAction } from "@/features/payments/checkout.actions";

type CardCheckoutFormProps = {
  slug: string;
  couponCode: string | null;
};

export function CardCheckoutForm({ slug, couponCode }: CardCheckoutFormProps) {
  const [state, formAction] = useActionState(startCardCheckoutAction, null);

  return (
    <form action={formAction}>
      <Stack>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="coupon" value={couponCode ?? ""} />
        <FormError message={state?.ok === false ? state.error : null} />
        <SubmitButton pendingText="Redirecting…">Continue to payment</SubmitButton>
      </Stack>
    </form>
  );
}
