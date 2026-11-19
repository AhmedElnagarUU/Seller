import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Heading } from "@/shared/ui/Heading";
import { requireAdmin } from "@/features/auth/session";
import { GrantThemeForm } from "@/features/ownerships/components/admin/GrantThemeForm";
import { listThemeOptionsForAdmin } from "@/features/themes/theme.service";
import { CustomerActivitySection } from "@/features/users/components/admin/CustomerActivitySection";
import { CustomerDetails } from "@/features/users/components/admin/CustomerDetails";
import { CustomerFeedbackSection } from "@/features/users/components/admin/CustomerFeedbackSection";
import { CustomerOrdersSection } from "@/features/users/components/admin/CustomerOrdersSection";
import { CustomerOwnedThemes } from "@/features/users/components/admin/CustomerOwnedThemes";
import { CustomerWalletSection } from "@/features/users/components/admin/CustomerWalletSection";
import { DisableCustomerForm } from "@/features/users/components/admin/DisableCustomerForm";
import { EnableCustomerForm } from "@/features/users/components/admin/EnableCustomerForm";
import { getCustomerForAdmin } from "@/features/users/customer-admin.service";

export const metadata: Metadata = {
  title: "Customer · Theme Store",
  robots: { index: false },
};

type AdminCustomerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCustomerPage({ params }: AdminCustomerPageProps) {
  const admin = await requireAdmin();
  const { id } = await params;
  const page = await getCustomerForAdmin(id);
  if (!page) notFound();
  const { customer } = page;
  const themes = await listThemeOptionsForAdmin();

  return (
    <Stack gap="lg">
      <Inline>
        <Heading level={1}>{customer.name}</Heading>
        <Badge tone={customer.isDisabled ? "danger" : "success"}>{customer.isDisabled ? "Disabled" : "Active"}</Badge>
      </Inline>
      <CustomerDetails customer={customer} />
      <Stack>
        <Heading level={2}>Owned themes</Heading>
        <CustomerOwnedThemes customerId={customer.id} ownerships={page.ownerships} />
      </Stack>
      <GrantThemeForm customerId={customer.id} themes={themes} />
      <Stack>
        <Heading level={2}>Orders</Heading>
        <CustomerOrdersSection orders={page.orders} />
      </Stack>
      <Stack>
        <Heading level={2}>Wallet payments</Heading>
        <CustomerWalletSection payments={page.walletPayments} />
      </Stack>
      <Stack>
        <Heading level={2}>Feedback</Heading>
        <CustomerFeedbackSection feedback={page.feedback} />
      </Stack>
      <Stack>
        <Heading level={2}>Recent activity</Heading>
        <CustomerActivitySection activity={page.activity} />
      </Stack>
      {customer.isDisabled ? <EnableCustomerForm customerId={customer.id} /> : null}
      {!customer.isDisabled && customer.id !== admin.id ? <DisableCustomerForm customerId={customer.id} /> : null}
    </Stack>
  );
}
