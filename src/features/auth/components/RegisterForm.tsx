"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { formKey, submittedValue } from "@/shared/lib/action-result";
import { FormError } from "@/shared/ui/FormError";
import { SelectField } from "@/shared/ui/SelectField";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { TextField } from "@/shared/ui/TextField";
import { registerAction } from "@/features/auth/auth.actions";

type RegisterFormProps = {
  countryOptions: { value: string; label: string }[];
  defaultCountry: string;
};

export function RegisterForm({ countryOptions, defaultCountry }: RegisterFormProps) {
  const [state, formAction] = useActionState(registerAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;

  return (
    <form key={formKey(state)} action={formAction}>
      <Stack>
        <FormError message={formError} />
        <TextField
          label="Name"
          name="name"
          autoComplete="name"
          defaultValue={submittedValue(state, "name", "")}
          required
          errors={fieldErrors?.name}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={submittedValue(state, "email", "")}
          required
          errors={fieldErrors?.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          required
          errors={fieldErrors?.password}
        />
        <SelectField
          label="Country"
          name="country"
          options={countryOptions}
          placeholder="Choose your country"
          defaultValue={submittedValue(state, "country", defaultCountry)}
          required
          errors={fieldErrors?.country}
        />
        <SubmitButton pendingText="Creating account…" fullWidth>
          Create account
        </SubmitButton>
      </Stack>
    </form>
  );
}
