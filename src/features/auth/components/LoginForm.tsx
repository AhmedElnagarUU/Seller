"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { TextField } from "@/shared/ui/TextField";
import { TextLink } from "@/shared/ui/TextLink";
import { loginAction } from "@/features/auth/auth.actions";

type LoginFormProps = {
  next: string;
  initialError: string | null;
};

export function LoginForm({ next, initialError }: LoginFormProps) {
  const [state, formAction] = useActionState(loginAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const actionError = state?.ok === false && !state.fieldErrors ? state.error : null;

  return (
    <form action={formAction}>
      <Stack>
        <FormError message={actionError ?? initialError} />
        <input type="hidden" name="next" value={next} />
        <TextField label="Email" name="email" type="email" autoComplete="email" required errors={fieldErrors?.email} />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          errors={fieldErrors?.password}
        />
        <TextLink href="/forgot-password">Forgot password?</TextLink>
        <SubmitButton pendingText="Logging in…" fullWidth>
          Log in
        </SubmitButton>
      </Stack>
    </form>
  );
}
