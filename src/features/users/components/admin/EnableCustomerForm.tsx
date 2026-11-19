"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { enableCustomerAction } from "@/features/users/user.actions";

type EnableCustomerFormProps = {
  customerId: string;
};

export function EnableCustomerForm({ customerId }: EnableCustomerFormProps) {
  const [state, formAction] = useActionState(enableCustomerAction, null);

  return (
    <form action={formAction}>
      <Stack>
        <FormError message={state?.ok === false ? state.error : null} />
        <input type="hidden" name="id" value={customerId} />
        <SubmitButton pendingText="Enabling…">Enable account</SubmitButton>
      </Stack>
    </form>
  );
}
