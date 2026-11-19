import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { Text } from "@/shared/ui/Text";
import { TextField } from "@/shared/ui/TextField";
import { applyCouponAction } from "@/features/payments/checkout.actions";

type CouponFieldProps = {
  slug: string;
  couponCode: string | null;
  error: string | null;
};

export function CouponField({ slug, couponCode, error }: CouponFieldProps) {
  const isApplied = couponCode !== null && error === null;

  return (
    <form action={applyCouponAction}>
      <Stack>
        <input type="hidden" name="slug" value={slug} />
        <TextField label="Coupon code" name="code" defaultValue={couponCode ?? ""} />
        <SubmitButton variant="secondary" pendingText="Applying…">
          Apply
        </SubmitButton>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {isApplied ? <Text tone="success">Coupon applied.</Text> : null}
      </Stack>
    </form>
  );
}
