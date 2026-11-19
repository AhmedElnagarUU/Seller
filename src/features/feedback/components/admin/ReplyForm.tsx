"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { formKey, submittedValue } from "@/shared/lib/action-result";
import { Alert } from "@/shared/ui/Alert";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { TextAreaField } from "@/shared/ui/TextAreaField";
import { replyToFeedbackAction } from "@/features/feedback/feedback.actions";

type ReplyFormProps = {
  feedbackId: string;
  // One reply per message: once there is a reply the form is hidden (the success message stays).
  hasReply: boolean;
};

export function ReplyForm({ feedbackId, hasReply }: ReplyFormProps) {
  const [state, formAction] = useActionState(replyToFeedbackAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;

  return (
    <Stack>
      {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
      {hasReply ? null : (
        <form key={formKey(state)} action={formAction}>
          <Stack>
            <FormError message={formError} />
            <input type="hidden" name="id" value={feedbackId} />
            <TextAreaField
              label="Reply"
              name="reply"
              rows={6}
              defaultValue={submittedValue(state, "reply", "")}
              required
              errors={fieldErrors?.reply}
            />
            <SubmitButton pendingText="Sending…">Send reply</SubmitButton>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
