"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { resendVerificationAction } from "@/features/auth/auth.actions";

export function ResendVerificationForm() {
  const [state, formAction] = useActionState(resendVerificationAction, null);

  return (
    <form action={formAction}>
      <Stack>
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <FormError message={state?.ok === false ? state.error : null} />
        <SubmitButton pendingText="Sending…" variant="secondary">
          Send the email again
        </SubmitButton>
      </Stack>
    </form>
  );
}
