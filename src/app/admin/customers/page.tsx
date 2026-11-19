import type { Metadata } from "next";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Button } from "@/shared/ui/Button";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Heading } from "@/shared/ui/Heading";
import { Pagination } from "@/shared/ui/Pagination";
import { Text } from "@/shared/ui/Text";
import { TextField } from "@/shared/ui/TextField";
import { requireAdmin } from "@/features/auth/session";
import { CustomerTable } from "@/features/users/components/admin/CustomerTable";
import { CUSTOMER_MESSAGES, CUSTOMER_STATUS_FILTERS, type CustomerStatusFilter } from "@/features/users/user.constants";
import { customerSearchParamsSchema } from "@/features/users/user.schemas";
import { listCustomers } from "@/features/users/user.service";

export const metadata: Metadata = {
  title: "Customers · Theme Store",
  robots: { index: false },
};

type AdminCustomersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_TAB_LABELS: Record<CustomerStatusFilter, string> = { active: "Active", disabled: "Disabled" };

function buildHref(status: CustomerStatusFilter | undefined, q: string, page: number): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/customers?${query}` : "/admin/customers";
}

export default async function AdminCustomersPage({ searchParams }: AdminCustomersPageProps) {
  await requireAdmin();
  const { status, q, page } = customerSearchParamsSchema.parse(await searchParams);
  const result = await listCustomers({ q, status, page });

  return (
    <Stack>
      <Heading level={1}>Customers</Heading>
      <Inline gap="sm" wrap>
        <ButtonLink href={buildHref(undefined, q, 1)} variant={status ? "secondary" : "primary"} size="sm">
          All
        </ButtonLink>
        {CUSTOMER_STATUS_FILTERS.map((tabStatus) => (
          <ButtonLink
            key={tabStatus}
            href={buildHref(tabStatus, q, 1)}
            variant={status === tabStatus ? "primary" : "secondary"}
            size="sm"
          >
            {STATUS_TAB_LABELS[tabStatus]}
          </ButtonLink>
        ))}
      </Inline>
      <form action="/admin/customers" method="get">
        <Inline align="end">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <TextField label="Search" name="q" defaultValue={q} />
          <Button type="submit">Search</Button>
        </Inline>
      </form>
      {result.items.length > 0 ? <CustomerTable customers={result.items} /> : <Text>{CUSTOMER_MESSAGES.empty}</Text>}
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        buildHref={(targetPage) => buildHref(status, q, targetPage)}
      />
    </Stack>
  );
}
