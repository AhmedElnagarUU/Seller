import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Divider } from "@/shared/ui/Divider";
import { Heading } from "@/shared/ui/Heading";
import { requireAdmin } from "@/features/auth/session";
import { CouponForm } from "@/features/coupons/components/admin/CouponForm";
import { DeleteCouponButton } from "@/features/coupons/components/admin/DeleteCouponButton";
import { getCouponForAdmin } from "@/features/coupons/coupon.service";
import { listThemesForCouponChoice } from "@/features/themes/theme.service";

export const metadata: Metadata = {
  title: "Edit coupon · Theme Store",
  robots: { index: false },
};

type EditCouponPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCouponPage({ params }: EditCouponPageProps) {
  await requireAdmin();
  const { id } = await params;
  const coupon = await getCouponForAdmin(id);
  if (!coupon) notFound();
  const themeChoices = await listThemesForCouponChoice();

  return (
    <Stack gap="lg">
      <Inline align="center">
        <Heading level={1}>{coupon.code}</Heading>
        <Badge tone={coupon.active ? "success" : "neutral"}>{coupon.active ? "Active" : "Inactive"}</Badge>
      </Inline>
      <CouponForm coupon={coupon} themeChoices={themeChoices} />
      <Divider />
      <DeleteCouponButton couponId={coupon.id} />
    </Stack>
  );
}
