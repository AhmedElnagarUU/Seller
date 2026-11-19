"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { formKey } from "@/shared/lib/action-result";
import { Alert } from "@/shared/ui/Alert";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { TextField } from "@/shared/ui/TextField";
import { changePasswordAction } from "@/features/users/account.actions";
import { ACCOUNT_MESSAGES } from "@/features/users/account.messages";

// Passwords are never sent back, so no field gets a default value.
export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;

  return (
    <form key={formKey(state)} action={formAction}>
      <Stack>
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <FormError message={formError} />
        <TextField
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          errors={fieldErrors?.currentPassword}
        />
        <TextField
          label="New password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          required
          errors={fieldErrors?.newPassword}
        />
        <TextField
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          errors={fieldErrors?.confirmPassword}
        />
        <SubmitButton pendingText="Saving…">{ACCOUNT_MESSAGES.passwordFormSubmit}</SubmitButton>
      </Stack>
    </form>
  );
}
