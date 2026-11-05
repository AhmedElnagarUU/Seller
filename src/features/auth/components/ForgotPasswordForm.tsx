"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { formKey, submittedValue } from "@/shared/lib/action-result";
import { Alert } from "@/shared/ui/Alert";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { TextField } from "@/shared/ui/TextField";
import { forgotPasswordAction } from "@/features/auth/auth.actions";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;

  return (
    <form key={formKey(state)} action={formAction}>
      <Stack>
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <FormError message={formError} />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={submittedValue(state, "email", "")}
          required
          errors={fieldErrors?.email}
        />
        <SubmitButton pendingText="Sending…" fullWidth>
          Send reset link
        </SubmitButton>
      </Stack>
    </form>
  );
}
