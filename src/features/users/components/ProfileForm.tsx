"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { formKey, submittedValue } from "@/shared/lib/action-result";
import { getCountryOptions } from "@/shared/lib/countries";
import { Alert } from "@/shared/ui/Alert";
import { FormError } from "@/shared/ui/FormError";
import { SelectField } from "@/shared/ui/SelectField";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { Text } from "@/shared/ui/Text";
import { TextField } from "@/shared/ui/TextField";
import { updateProfileAction } from "@/features/users/account.actions";
import type { AccountSettingsDTO } from "@/features/users/account.types";

type ProfileFormProps = {
  settings: Pick<AccountSettingsDTO, "name" | "email" | "country">;
};

export function ProfileForm({ settings }: ProfileFormProps) {
  const [state, formAction] = useActionState(updateProfileAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;

  return (
    <form key={formKey(state)} action={formAction}>
      <Stack>
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <FormError message={formError} />
        <TextField
          label="Name"
          name="name"
          autoComplete="name"
          defaultValue={submittedValue(state, "name", settings.name)}
          required
          errors={fieldErrors?.name}
        />
        <SelectField
          label="Country"
          name="country"
          options={getCountryOptions()}
          defaultValue={submittedValue(state, "country", settings.country ?? "")}
          placeholder="Choose your country"
          required
          errors={fieldErrors?.country}
        />
        <Text>Email: {settings.email}</Text>
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
      </Stack>
    </form>
  );
}
