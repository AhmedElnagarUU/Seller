"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { retryNotificationJobAction } from "@/features/notifications/notification.actions";

type RetryJobButtonProps = {
  jobId: string;
};

export function RetryJobButton({ jobId }: RetryJobButtonProps) {
  const [state, formAction] = useActionState(retryNotificationJobAction, null);

  return (
    <form action={formAction}>
      <Stack gap="xs">
        <FormError message={state?.ok === false ? state.error : null} />
        <input type="hidden" name="jobId" value={jobId} />
        <SubmitButton size="sm" pendingText="Retrying…">
          Retry
        </SubmitButton>
      </Stack>
    </form>
  );
}
