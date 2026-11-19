"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { markWalletOrderRefundedAction } from "@/features/orders/order-admin.actions";

type MarkRefundedButtonProps = {
  orderId: string;
};

const CONFIRM_TEXT = "The customer loses access to the theme. Did you already send the money back?";

export function MarkRefundedButton({ orderId }: MarkRefundedButtonProps) {
  const [state, formAction] = useActionState(markWalletOrderRefundedAction, null);
  const formError = state?.ok === false ? state.error : null;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(CONFIRM_TEXT)) event.preventDefault();
      }}
    >
      <Stack>
        <FormError message={formError} />
        <input type="hidden" name="orderId" value={orderId} />
        <SubmitButton variant="danger" pendingText="Saving…">
          Mark as refunded
        </SubmitButton>
      </Stack>
    </form>
  );
}
