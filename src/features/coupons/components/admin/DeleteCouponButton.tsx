"use client";

import { useActionState } from "react";
import { Stack } from "@/shared/layout/Stack";
import { FormError } from "@/shared/ui/FormError";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { deleteCouponAction } from "@/features/coupons/coupon.actions";

type DeleteCouponButtonProps = {
  couponId: string;
};

export function DeleteCouponButton({ couponId }: DeleteCouponButtonProps) {
  const [state, formAction] = useActionState(deleteCouponAction, null);
  const formError = state?.ok === false ? state.error : null;

  return (
    <form action={formAction}>
      <Stack>
        <FormError message={formError} />
        <input type="hidden" name="id" value={couponId} />
        <SubmitButton variant="danger" pendingText="Deleting…">
          Delete coupon
        </SubmitButton>
      </Stack>
    </form>
  );
}
