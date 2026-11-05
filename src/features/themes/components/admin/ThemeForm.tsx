"use client";

import { useActionState } from "react";
import { Grid } from "@/shared/layout/Grid";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormError } from "@/shared/ui/FormError";
import { SelectField } from "@/shared/ui/SelectField";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { Text } from "@/shared/ui/Text";
import { TextAreaField } from "@/shared/ui/TextAreaField";
import { TextField } from "@/shared/ui/TextField";
import { createThemeAction, updateThemeAction } from "@/features/themes/theme.actions";
import type { ThemeAdminDTO } from "@/features/themes/theme.types";

const CENTS_PER_DOLLAR = 100;

type ThemeFormProps = {
  theme?: ThemeAdminDTO;
  categoryOptions: { value: string; label: string }[];
};

// 2900 becomes "29.00".
function toDollarText(priceCents: number): string {
  return (priceCents / CENTS_PER_DOLLAR).toFixed(2);
}

export function ThemeForm({ theme, categoryOptions }: ThemeFormProps) {
  const [state, formAction] = useActionState(theme ? updateThemeAction : createThemeAction, null);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;
  // The slug is part of the theme's web address, so it is fixed after the first publish (D-017).
  const isSlugLocked = theme?.publishedAt !== null && theme?.publishedAt !== undefined;

  return (
    <form action={formAction} noValidate>
      <Stack>
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <FormError message={formError} />
        {theme ? <input type="hidden" name="id" value={theme.id} /> : null}
        <TextField label="Name" name="name" defaultValue={theme?.name} required errors={fieldErrors?.name} />
        {isSlugLocked ? (
          <Stack gap="xs">
            <input type="hidden" name="slug" value={theme?.slug} />
            <Text size="sm" weight="bold">
              Slug
            </Text>
            <Text>{theme?.slug}</Text>
            <Text size="sm" tone="muted">
              The slug cannot change after the theme was published.
            </Text>
          </Stack>
        ) : (
          <TextField label="Slug" name="slug" defaultValue={theme?.slug} required errors={fieldErrors?.slug} />
        )}
        <TextField
          label="Tagline"
          name="tagline"
          defaultValue={theme?.tagline}
          required
          errors={fieldErrors?.tagline}
        />
        <SelectField
          label="Category"
          name="categoryId"
          options={categoryOptions}
          defaultValue={theme?.categoryId}
          placeholder="Choose a category"
          required
          errors={fieldErrors?.categoryId}
        />
        <TextField
          label="Price (USD)"
          name="price"
          type="number"
          defaultValue={theme ? toDollarText(theme.priceCents) : undefined}
          required
          errors={fieldErrors?.price}
        />
        <TextField
          label="Demo URL"
          name="demoUrl"
          type="url"
          defaultValue={theme?.demoUrl ?? ""}
          errors={fieldErrors?.demoUrl}
        />
        <TextAreaField
          label="Description"
          name="description"
          rows={12}
          defaultValue={theme?.description}
          hint="Markdown supported."
          required
          errors={fieldErrors?.description}
        />
        <TextAreaField
          label="Features"
          name="features"
          defaultValue={theme?.features.join("\n")}
          errors={fieldErrors?.features}
        />
        <Grid columns={3}>
          <TextField
            label="WordPress minimum"
            name="wordpressMin"
            defaultValue={theme?.wordpressMin}
            required
            errors={fieldErrors?.wordpressMin}
          />
          <TextField
            label="PHP minimum"
            name="phpMin"
            defaultValue={theme?.phpMin}
            required
            errors={fieldErrors?.phpMin}
          />
          <TextField
            label="Tested up to"
            name="testedUpTo"
            defaultValue={theme?.testedUpTo}
            required
            errors={fieldErrors?.testedUpTo}
          />
        </Grid>
        <CheckboxField label="Featured on the home page" name="featured" defaultChecked={theme?.featured} />
        <SubmitButton pendingText="Saving…">{theme ? "Save changes" : "Create draft"}</SubmitButton>
      </Stack>
    </form>
  );
}
