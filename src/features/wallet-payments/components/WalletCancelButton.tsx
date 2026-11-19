"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { cancelWalletPaymentAction } from "@/features/wallet-payments/wallet-payment.actions";

type WalletCancelButtonProps = {
  walletPaymentId: string;
};

export function WalletCancelButton({ walletPaymentId }: WalletCancelButtonProps) {
  const [state, formAction] = useActionState(cancelWalletPaymentAction, null);

  return (
    <form action={formAction}>
      <Stack>
        <FormError message={state?.ok === false ? state.error : null} />
        <input type="hidden" name="id" value={walletPaymentId} />
        <SubmitButton variant="ghost" pendingText="Cancelling…">
          Cancel payment
        </SubmitButton>
      </Stack>
    </form>
  );
}
