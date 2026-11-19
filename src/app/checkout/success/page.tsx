import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { TextLink } from "@/shared/ui/TextLink";
import { requireUser } from "@/features/auth/session";
import { DownloadButton } from "@/features/downloads/components/DownloadButton";
import { getOrderForCheckout } from "@/features/orders/order.service";
import { checkoutSuccessSearchParamsSchema } from "@/features/payments/checkout.schemas";
import { SuccessWaiting } from "@/features/payments/components/SuccessWaiting";
import { listVersionsForTheme } from "@/features/versions/version.service";

export const metadata: Metadata = {
  title: "Payment · Theme Store",
  robots: { index: false },
};

type CheckoutSuccessPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const user = await requireUser("/checkout/success");
  const { checkout_id: checkoutId } = checkoutSuccessSearchParamsSchema.parse(await searchParams);
  if (!checkoutId) redirect("/account/orders");
  const order = await getOrderForCheckout(user.id, checkoutId);
  if (!order) {
    return (
      <PageContainer width="narrow">
        <SuccessWaiting />
      </PageContainer>
    );
  }
  const [newestVersion] = await listVersionsForTheme(order.themeId);

  return (
    <PageContainer width="narrow">
      <Stack align="start">
        <Heading level={1}>{`Thank you! ${order.themeName} is yours.`}</Heading>
        {newestVersion ? (
          <DownloadButton versionId={newestVersion.id} label={`Download ${newestVersion.version}`} />
        ) : null}
        <TextLink href="/account/themes">My themes</TextLink>
      </Stack>
    </PageContainer>
  );
}
