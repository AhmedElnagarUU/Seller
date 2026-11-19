"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { formKey, submittedValue } from "@/shared/lib/action-result";
import { Alert } from "@/shared/ui/Alert";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { TextAreaField } from "@/shared/ui/TextAreaField";
import { TextField } from "@/shared/ui/TextField";
import { sendFeedbackAction } from "@/features/feedback/feedback.actions";

export function FeedbackForm() {
  const [state, formAction] = useActionState(sendFeedbackAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;

  return (
    <form key={formKey(state)} action={formAction}>
      <Stack>
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <FormError message={formError} />
        <TextField
          label="Subject"
          name="subject"
          defaultValue={submittedValue(state, "subject", "")}
          required
          errors={fieldErrors?.subject}
        />
        <TextAreaField
          label="Message"
          name="message"
          rows={6}
          defaultValue={submittedValue(state, "message", "")}
          required
          errors={fieldErrors?.message}
        />
        <SubmitButton pendingText="Sending…">Send feedback</SubmitButton>
      </Stack>
    </form>
  );
}
