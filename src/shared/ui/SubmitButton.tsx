"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/shared/ui/Button";
import type { ButtonSize, ButtonVariant } from "@/shared/ui/buttonClasses";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingText: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

export function SubmitButton({ children, pendingText, variant, size, fullWidth }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} fullWidth={fullWidth} disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}
