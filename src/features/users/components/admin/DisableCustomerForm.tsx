"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { formKey, submittedValue } from "@/shared/lib/action-result";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { TextField } from "@/shared/ui/TextField";
import { disableCustomerAction } from "@/features/users/user.actions";

type DisableCustomerFormProps = {
  customerId: string;
};

export function DisableCustomerForm({ customerId }: DisableCustomerFormProps) {
  const [state, formAction] = useActionState(disableCustomerAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;

  return (
    <form key={formKey(state)} action={formAction}>
      <Stack>
        <FormError message={formError} />
        <input type="hidden" name="id" value={customerId} />
        <TextField
          label="Reason"
          name="reason"
          defaultValue={submittedValue(state, "reason", "")}
          required
          errors={fieldErrors?.reason}
        />
        <SubmitButton variant="danger" pendingText="Disabling…">
          Disable account
        </SubmitButton>
      </Stack>
    </form>
  );
}
