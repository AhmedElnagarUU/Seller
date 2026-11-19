import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/shared/config/env";
import { PageContainer } from "@/shared/layout/PageContainer";
import { requireVerifiedUser } from "@/features/auth/session";
import { fakeCheckoutSearchParamsSchema } from "@/features/payments/checkout.schemas";
import { getFakeCheckoutData } from "@/features/payments/checkout.service";
import { FakeCheckoutForm } from "@/features/payments/components/FakeCheckoutForm";

export const metadata: Metadata = {
  title: "Checkout · Theme Store",
  robots: { index: false },
};

type FakeCheckoutPageProps = {
  params: Promise<{ checkoutId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FakeCheckoutPage({ params, searchParams }: FakeCheckoutPageProps) {
  if (env.PAYMENT_PROVIDER !== "fake") notFound();
  const { checkoutId } = await params;
  const { theme: themeId, coupon: couponId } = fakeCheckoutSearchParamsSchema.parse(await searchParams);
  await requireVerifiedUser("/checkout/fake/" + checkoutId);
  const data = await getFakeCheckoutData({ themeId, couponId });
  if (!data) notFound();

  return (
    <PageContainer width="narrow">
      <FakeCheckoutForm checkoutId={checkoutId} themeId={themeId} couponId={couponId} data={data} />
    </PageContainer>
  );
}
