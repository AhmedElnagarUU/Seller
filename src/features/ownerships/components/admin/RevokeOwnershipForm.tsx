"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { formKey, submittedValue } from "@/shared/lib/action-result";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { TextField } from "@/shared/ui/TextField";
import { revokeOwnershipAction } from "@/features/ownerships/ownership.actions";

type RevokeOwnershipFormProps = {
  userId: string;
  themeId: string;
};

export function RevokeOwnershipForm({ userId, themeId }: RevokeOwnershipFormProps) {
  const [state, formAction] = useActionState(revokeOwnershipAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;

  return (
    <form key={formKey(state)} action={formAction}>
      <Stack>
        <FormError message={formError} />
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="themeId" value={themeId} />
        <TextField
          label="Note"
          name="note"
          defaultValue={submittedValue(state, "note", "")}
          required
          errors={fieldErrors?.note}
        />
        <SubmitButton variant="danger" size="sm" pendingText="Removing…">
          Remove access
        </SubmitButton>
      </Stack>
    </form>
  );
}
