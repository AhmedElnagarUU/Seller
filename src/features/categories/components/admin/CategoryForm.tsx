"use client";

import { useActionState, useState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { formKey, submittedValue } from "@/shared/lib/action-result";
import { Alert } from "@/shared/ui/Alert";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { TextAreaField } from "@/shared/ui/TextAreaField";
import { TextField } from "@/shared/ui/TextField";
import { createCategoryAction, updateCategoryAction } from "@/features/categories/category.actions";
import type { CategoryAdminDTO } from "@/features/categories/category.types";

type CategoryFormProps = {
  category?: CategoryAdminDTO;
};

// "Blog Themes" becomes "blog-themes".
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CategoryForm({ category }: CategoryFormProps) {
  const [state, formAction] = useActionState(category ? updateCategoryAction : createCategoryAction, null);
  // An existing category keeps its slug. A new one follows the name until the admin edits the slug.
  const [isSlugEdited, setIsSlugEdited] = useState(category !== undefined);
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const formError = state?.ok === false && !state.fieldErrors ? state.error : null;

  function handleInput(event: React.FormEvent<HTMLFormElement>) {
    const field = event.target;
    if (!(field instanceof HTMLInputElement)) return;
    if (field.name === "slug") setIsSlugEdited(true);
    if (field.name !== "name" || isSlugEdited) return;
    const slugField = event.currentTarget.elements.namedItem("slug");
    if (slugField instanceof HTMLInputElement) slugField.value = toSlug(field.value);
  }

  return (
    <form key={formKey(state)} action={formAction} onInput={handleInput}>
      <Stack>
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <FormError message={formError} />
        {category ? <input type="hidden" name="id" value={category.id} /> : null}
        <TextField
          label="Name"
          name="name"
          defaultValue={submittedValue(state, "name", category?.name ?? "")}
          required
          errors={fieldErrors?.name}
        />
        <TextField
          label="Slug"
          name="slug"
          defaultValue={submittedValue(state, "slug", category?.slug ?? "")}
          required
          errors={fieldErrors?.slug}
        />
        <TextAreaField
          label="Description"
          name="description"
          defaultValue={submittedValue(state, "description", category?.description ?? "")}
          errors={fieldErrors?.description}
        />
        <TextField
          label="Sort order"
          name="sortOrder"
          type="number"
          defaultValue={submittedValue(state, "sortOrder", String(category?.sortOrder ?? 0))}
          hint="Lower numbers show first."
          errors={fieldErrors?.sortOrder}
        />
        <SubmitButton pendingText="Saving…">{category ? "Save changes" : "Create category"}</SubmitButton>
      </Stack>
    </form>
  );
}
