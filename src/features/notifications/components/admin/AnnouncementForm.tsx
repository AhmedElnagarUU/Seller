"use client";

import { useActionState, useState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { formKey, submittedValue } from "@/shared/lib/action-result";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormError } from "@/shared/ui/FormError";
import { SelectField } from "@/shared/ui/SelectField";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { TextAreaField } from "@/shared/ui/TextAreaField";
import { TextField } from "@/shared/ui/TextField";
import { ANNOUNCEMENT_AUDIENCE_OPTIONS, ANNOUNCEMENT_MESSAGES } from "@/features/notifications/announcement.constants";
import { sendAnnouncementAction } from "@/features/notifications/announcement.actions";
import { THEME_STATUS_LABELS, type ThemeStatus } from "@/features/themes/theme.constants";

type AnnouncementFormProps = {
  themes: { id: string; name: string; status: ThemeStatus }[];
};

export function AnnouncementForm({ themes }: AnnouncementFormProps) {
  const [state, formAction] = useActionState(sendAnnouncementAction, null);
  const [audience, setAudience] = useState(() => submittedValue(state, "audience", "all_customers"));
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;
  const themeOptions = themes.map((theme) => ({
    value: theme.id,
    label: `${theme.name} (${THEME_STATUS_LABELS[theme.status]})`,
  }));

  function handleChange(event: React.ChangeEvent<HTMLFormElement>) {
    const field = event.target;
    if (field instanceof HTMLSelectElement && field.name === "audience") setAudience(field.value);
  }

  return (
    <form key={formKey(state)} action={formAction} onChange={handleChange}>
      <Stack>
        <FormError message={formError} />
        <TextField
          label="Title"
          name="title"
          defaultValue={submittedValue(state, "title", "")}
          required
          errors={fieldErrors?.title}
        />
        <TextAreaField
          label="Message"
          name="body"
          rows={5}
          defaultValue={submittedValue(state, "body", "")}
          required
          errors={fieldErrors?.body}
        />
        <TextField
          label="Link"
          name="link"
          defaultValue={submittedValue(state, "link", "")}
          hint={ANNOUNCEMENT_MESSAGES.linkHint}
          errors={fieldErrors?.link}
        />
        <SelectField
          label="Audience"
          name="audience"
          options={[...ANNOUNCEMENT_AUDIENCE_OPTIONS]}
          defaultValue={submittedValue(state, "audience", "all_customers")}
          errors={fieldErrors?.audience}
        />
        {audience === "theme_owners" ? (
          <SelectField
            label="Theme"
            name="themeId"
            options={themeOptions}
            placeholder="Choose a theme"
            defaultValue={submittedValue(state, "themeId", "")}
            errors={fieldErrors?.themeId}
          />
        ) : null}
        {audience === "one_customer" ? (
          <TextField
            label="Customer email"
            name="customerEmail"
            type="email"
            defaultValue={submittedValue(state, "customerEmail", "")}
            errors={fieldErrors?.customerEmail}
          />
        ) : null}
        <CheckboxField label="Also send by email" name="sendEmail" hint={ANNOUNCEMENT_MESSAGES.sendEmailHint} />
        <SubmitButton pendingText="Sending…">Send announcement</SubmitButton>
      </Stack>
    </form>
  );
}
