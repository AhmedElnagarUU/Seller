import type { Metadata } from "next";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { requireAdmin } from "@/features/auth/session";
import { CouponTable } from "@/features/coupons/components/admin/CouponTable";
import { listCouponsForAdmin } from "@/features/coupons/coupon.service";

export const metadata: Metadata = {
  title: "Coupons · Theme Store",
  robots: { index: false },
};

export default async function AdminCouponsPage() {
  await requireAdmin();
  const coupons = await listCouponsForAdmin();

  return (
    <Stack>
      <Inline justify="between">
        <Heading level={1}>Coupons</Heading>
        <ButtonLink href="/admin/coupons/new">New coupon</ButtonLink>
      </Inline>
      {coupons.length > 0 ? <CouponTable coupons={coupons} /> : <Text>No coupons yet.</Text>}
    </Stack>
  );
}
