"use client";

import { useActionState } from "react";
import { formKey, submittedValue } from "@/shared/lib/action-result";
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

  // What the user typed before an error, otherwise the saved value.
  const valueOf = (key: string, initial: string): string => submittedValue(state, key, initial);

  return (
    <form key={formKey(state)} action={formAction}>
      <Stack>
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <FormError message={formError} />
        {theme ? <input type="hidden" name="id" value={theme.id} /> : null}
        <TextField
          label="Name"
          name="name"
          defaultValue={valueOf("name", theme?.name ?? "")}
          required
          errors={fieldErrors?.name}
        />
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
          <TextField
            label="Slug"
            name="slug"
            defaultValue={valueOf("slug", theme?.slug ?? "")}
            required
            errors={fieldErrors?.slug}
          />
        )}
        <TextField
          label="Tagline"
          name="tagline"
          defaultValue={valueOf("tagline", theme?.tagline ?? "")}
          required
          errors={fieldErrors?.tagline}
        />
        <SelectField
          label="Category"
          name="categoryId"
          options={categoryOptions}
          defaultValue={valueOf("categoryId", theme?.categoryId ?? "")}
          placeholder="Choose a category"
          required
          errors={fieldErrors?.categoryId}
        />
        <TextField
          label="Price (USD)"
          name="price"
          type="number"
          step="0.01"
          inputMode="decimal"
          defaultValue={valueOf("price", theme ? toDollarText(theme.priceCents) : "")}
          required
          errors={fieldErrors?.price}
        />
        <TextField
          label="Demo URL"
          name="demoUrl"
          type="url"
          defaultValue={valueOf("demoUrl", theme?.demoUrl ?? "")}
          errors={fieldErrors?.demoUrl}
        />
        <TextAreaField
          label="Description"
          name="description"
          rows={12}
          defaultValue={valueOf("description", theme?.description ?? "")}
          hint="Markdown supported."
          required
          errors={fieldErrors?.description}
        />
        <TextAreaField
          label="Features"
          name="features"
          defaultValue={valueOf("features", theme?.features.join("\n") ?? "")}
          errors={fieldErrors?.features}
        />
        <Grid columns={3}>
          <TextField
            label="WordPress minimum"
            name="wordpressMin"
            defaultValue={valueOf("wordpressMin", theme?.wordpressMin ?? "")}
            required
            errors={fieldErrors?.wordpressMin}
          />
          <TextField
            label="PHP minimum"
            name="phpMin"
            defaultValue={valueOf("phpMin", theme?.phpMin ?? "")}
            required
            errors={fieldErrors?.phpMin}
          />
          <TextField
            label="Tested up to"
            name="testedUpTo"
            defaultValue={valueOf("testedUpTo", theme?.testedUpTo ?? "")}
            required
            errors={fieldErrors?.testedUpTo}
          />
        </Grid>
        <CheckboxField
          label="Featured on the home page"
          name="featured"
          defaultChecked={valueOf("featured", theme?.featured ? "on" : "") === "on"}
        />
        <SubmitButton pendingText="Saving…">{theme ? "Save changes" : "Create draft"}</SubmitButton>
      </Stack>
    </form>
  );
}
