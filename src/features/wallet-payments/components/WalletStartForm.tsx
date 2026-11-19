"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { startWalletPaymentAction } from "@/features/wallet-payments/wallet-payment.actions";

type WalletStartFormProps = {
  slug: string;
  couponCode: string | null;
};

export function WalletStartForm({ slug, couponCode }: WalletStartFormProps) {
  const [state, formAction] = useActionState(startWalletPaymentAction, null);

  return (
    <form action={formAction}>
      <Stack>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="coupon" value={couponCode ?? ""} />
        <FormError message={state?.ok === false ? state.error : null} />
        <SubmitButton pendingText="Starting…">Pay with wallet</SubmitButton>
      </Stack>
    </form>
  );
}
