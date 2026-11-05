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
import { ThemeTable } from "@/features/themes/components/admin/ThemeTable";
import { THEME_STATUS_LABELS, THEME_STATUSES, type ThemeStatus } from "@/features/themes/theme.constants";
import { adminThemeSearchParamsSchema } from "@/features/themes/theme.schemas";
import { listThemesForAdmin } from "@/features/themes/theme.service";

export const metadata: Metadata = {
  title: "Themes · Theme Store",
  robots: { index: false },
};

type AdminThemesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildHref(status: ThemeStatus | undefined, q: string, page: number): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/themes?${query}` : "/admin/themes";
}

export default async function AdminThemesPage({ searchParams }: AdminThemesPageProps) {
  await requireAdmin();
  const { status, q, page } = adminThemeSearchParamsSchema.parse(await searchParams);
  const result = await listThemesForAdmin({ status, q, page });

  return (
    <Stack>
      <Inline justify="between">
        <Heading level={1}>Themes</Heading>
        <ButtonLink href="/admin/themes/new">New theme</ButtonLink>
      </Inline>
      <Inline gap="sm" wrap>
        <ButtonLink href={buildHref(undefined, q, 1)} variant={status ? "secondary" : "primary"} size="sm">
          All
        </ButtonLink>
        {THEME_STATUSES.map((tabStatus) => (
          <ButtonLink
            key={tabStatus}
            href={buildHref(tabStatus, q, 1)}
            variant={status === tabStatus ? "primary" : "secondary"}
            size="sm"
          >
            {THEME_STATUS_LABELS[tabStatus]}
          </ButtonLink>
        ))}
      </Inline>
      <form action="/admin/themes" method="get">
        <Inline align="end">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <TextField label="Search" name="q" defaultValue={q} />
          <Button type="submit">Search</Button>
        </Inline>
      </form>
      {result.items.length > 0 ? <ThemeTable themes={result.items} /> : <Text>No themes yet.</Text>}
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        buildHref={(targetPage) => buildHref(status, q, targetPage)}
      />
    </Stack>
  );
}
