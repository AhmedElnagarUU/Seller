import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { requireAdmin } from "@/features/auth/session";
import { CouponForm } from "@/features/coupons/components/admin/CouponForm";
import { listThemesForCouponChoice } from "@/features/themes/theme.service";

export const metadata: Metadata = {
  title: "New coupon · Theme Store",
  robots: { index: false },
};

export default async function NewCouponPage() {
  await requireAdmin();
  const themeChoices = await listThemesForCouponChoice();

  return (
    <Stack>
      <Heading level={1}>New coupon</Heading>
      <CouponForm themeChoices={themeChoices} />
    </Stack>
  );
}
