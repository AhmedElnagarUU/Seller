"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { reopenFeedbackAction, resolveFeedbackAction } from "@/features/feedback/feedback.actions";
import type { FeedbackStatus } from "@/features/feedback/feedback.constants";

type ResolveButtonProps = {
  feedbackId: string;
  status: FeedbackStatus;
};

export function ResolveButton({ feedbackId, status }: ResolveButtonProps) {
  const isResolved = status === "resolved";
  const [state, formAction] = useActionState(isResolved ? reopenFeedbackAction : resolveFeedbackAction, null);

  return (
    <form action={formAction}>
      <Stack>
        <FormError message={state?.ok === false ? state.error : null} />
        <input type="hidden" name="id" value={feedbackId} />
        <SubmitButton variant="secondary" pendingText="Saving…">
          {isResolved ? "Reopen" : "Mark as resolved"}
        </SubmitButton>
      </Stack>
    </form>
  );
}
