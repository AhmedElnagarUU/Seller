"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import type { ActionResult } from "@/shared/types/action";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import type { ButtonSize, ButtonVariant } from "@/shared/ui/buttonClasses";

type FavoriteToggleFormProps = {
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  targetId: string;
  label: string;
  pendingText: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function FavoriteToggleForm({
  action,
  targetId,
  label,
  pendingText,
  variant = "secondary",
  size,
}: FavoriteToggleFormProps) {
  const [state, formAction] = useActionState(action, null);
  const formError = state?.ok === false ? state.error : null;

  return (
    <form action={formAction}>
      <Stack gap="sm">
        <FormError message={formError} />
        <input type="hidden" name="targetId" value={targetId} />
        <SubmitButton variant={variant} size={size} pendingText={pendingText}>
          {label}
        </SubmitButton>
      </Stack>
    </form>
  );
}
