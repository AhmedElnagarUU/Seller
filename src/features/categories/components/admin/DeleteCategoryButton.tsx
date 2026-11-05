"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { deleteCategoryAction } from "@/features/categories/category.actions";

type DeleteCategoryButtonProps = {
  categoryId: string;
};

export function DeleteCategoryButton({ categoryId }: DeleteCategoryButtonProps) {
  const [state, formAction] = useActionState(deleteCategoryAction, null);
  const formError = state?.ok === false ? state.error : null;

  return (
    <form action={formAction}>
      <Stack>
        <FormError message={formError} />
        <input type="hidden" name="id" value={categoryId} />
        <SubmitButton variant="danger" pendingText="Deleting…">
          Delete category
        </SubmitButton>
      </Stack>
    </form>
  );
}
