"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { TextField } from "@/shared/ui/TextField";
import { resetPasswordAction } from "@/features/auth/auth.actions";

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, formAction] = useActionState(resetPasswordAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;

  return (
    <form action={formAction}>
      <Stack>
        <FormError message={formError} />
        <input type="hidden" name="token" value={token} />
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          required
          errors={fieldErrors?.password}
        />
        <TextField
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          errors={fieldErrors?.confirmPassword}
        />
        <SubmitButton pendingText="Saving…" fullWidth>
          Change password
        </SubmitButton>
      </Stack>
    </form>
  );
}
