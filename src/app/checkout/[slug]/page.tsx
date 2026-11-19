import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { requireVerifiedUser } from "@/features/auth/session";
import { CheckoutSummary } from "@/features/payments/components/CheckoutSummary";
import { CountryForm } from "@/features/payments/components/CountryForm";
import { CouponField } from "@/features/payments/components/CouponField";
import { PaymentMethodPicker } from "@/features/payments/components/PaymentMethodPicker";
import { checkoutSearchParamsSchema } from "@/features/payments/checkout.schemas";
import { getCheckoutPageData } from "@/features/payments/checkout.service";

export const metadata: Metadata = {
  title: "Checkout · Theme Store",
  robots: { index: false },
};

type CheckoutPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { slug } = await params;
  const { coupon } = checkoutSearchParamsSchema.parse(await searchParams);
  const user = await requireVerifiedUser("/checkout/" + slug);
  const couponCode = coupon === "" ? null : coupon;
  if (user.country === null) {
    return (
      <PageContainer width="narrow">
        <CountryForm slug={slug} couponCode={couponCode} />
      </PageContainer>
    );
  }
  const data = await getCheckoutPageData(user.id, slug, couponCode);
  if (data.kind === "not_found") notFound();
  if (data.kind === "owned") redirect("/account/themes");

  return (
    <PageContainer width="narrow">
      <Stack gap="lg">
        <CheckoutSummary theme={data.theme} quote={data.quote} finalPriceCents={data.finalPriceCents} />
        <CouponField slug={data.theme.slug} couponCode={data.couponCode} error={data.couponError} />
        <PaymentMethodPicker slug={data.theme.slug} couponCode={data.couponCode} wallet={data.wallet} />
      </Stack>
    </PageContainer>
  );
}
