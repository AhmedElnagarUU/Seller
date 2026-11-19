"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { formKey } from "@/shared/lib/action-result";
import { Alert } from "@/shared/ui/Alert";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { updateEmailPreferencesAction } from "@/features/users/account.actions";
import type { AccountSettingsDTO } from "@/features/users/account.types";

type EmailPreferencesFormProps = {
  settings: Pick<
    AccountSettingsDTO,
    "emailOwnedThemeUpdates" | "emailFavoriteThemeUpdates" | "emailFollowedCategoryThemes" | "emailAnnouncements"
  >;
};

export function EmailPreferencesForm({ settings }: EmailPreferencesFormProps) {
  const [state, formAction] = useActionState(updateEmailPreferencesAction, null);
  const formError = state?.ok === false ? state.error : null;

  return (
    <form key={formKey(state)} action={formAction}>
      <Stack>
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <FormError message={formError} />
        <CheckboxField
          label="New versions of themes I own"
          name="emailOwnedThemeUpdates"
          defaultChecked={settings.emailOwnedThemeUpdates}
        />
        <CheckboxField
          label="New versions of themes I favorited"
          name="emailFavoriteThemeUpdates"
          defaultChecked={settings.emailFavoriteThemeUpdates}
        />
        <CheckboxField
          label="New themes in categories I follow"
          name="emailFollowedCategoryThemes"
          defaultChecked={settings.emailFollowedCategoryThemes}
        />
        <CheckboxField
          label="Announcements from the store"
          name="emailAnnouncements"
          defaultChecked={settings.emailAnnouncements}
        />
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </Stack>
    </form>
  );
}
