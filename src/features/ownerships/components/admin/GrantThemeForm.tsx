"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { formKey, submittedValue } from "@/shared/lib/action-result";
import { Alert } from "@/shared/ui/Alert";
import { FormError } from "@/shared/ui/FormError";
import { SelectField } from "@/shared/ui/SelectField";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { TextField } from "@/shared/ui/TextField";
import { grantThemeAction } from "@/features/ownerships/ownership.actions";
import { THEME_STATUS_LABELS, type ThemeStatus } from "@/features/themes/theme.constants";

type GrantThemeFormProps = {
  customerId: string;
  themes: { id: string; name: string; status: ThemeStatus }[];
};

export function GrantThemeForm({ customerId, themes }: GrantThemeFormProps) {
  const [state, formAction] = useActionState(grantThemeAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;
  const options = themes.map((theme) => ({
    value: theme.id,
    label: `${theme.name} (${THEME_STATUS_LABELS[theme.status]})`,
  }));

  return (
    <form key={formKey(state)} action={formAction}>
      <Stack>
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <FormError message={formError} />
        <input type="hidden" name="userId" value={customerId} />
        <SelectField
          label="Theme"
          name="themeId"
          options={options}
          placeholder="Choose a theme"
          defaultValue={submittedValue(state, "themeId", "")}
          required
          errors={fieldErrors?.themeId}
        />
        <TextField
          label="Note"
          name="note"
          defaultValue={submittedValue(state, "note", "")}
          errors={fieldErrors?.note}
        />
        <SubmitButton pendingText="Giving…">Give a theme</SubmitButton>
      </Stack>
    </form>
  );
}
