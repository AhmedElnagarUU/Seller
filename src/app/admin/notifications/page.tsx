import type { Metadata } from "next";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Heading } from "@/shared/ui/Heading";
import { Pagination } from "@/shared/ui/Pagination";
import { Text } from "@/shared/ui/Text";
import { requireAdmin } from "@/features/auth/session";
import { ANNOUNCEMENT_MESSAGES, ANNOUNCEMENT_QUEUED_MESSAGE } from "@/features/notifications/announcement.constants";
import { listAnnouncementJobs } from "@/features/notifications/announcement.service";
import { AnnouncementTable } from "@/features/notifications/components/admin/AnnouncementTable";

export const metadata: Metadata = {
  title: "Notifications · Theme Store",
  robots: { index: false },
};

type AdminNotificationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readPage(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

function buildHref(page: number): string {
  return page > 1 ? `/admin/notifications?page=${page}` : "/admin/notifications";
}

export default async function AdminNotificationsPage({ searchParams }: AdminNotificationsPageProps) {
  await requireAdmin();
  const query = await searchParams;
  const result = await listAnnouncementJobs(readPage(query.page));

  return (
    <Stack>
      <Inline justify="between">
        <Heading level={1}>Notifications</Heading>
        <ButtonLink href="/admin/notifications/new">New announcement</ButtonLink>
      </Inline>
      {query.queued === "1" ? <Alert tone="success">{ANNOUNCEMENT_QUEUED_MESSAGE}</Alert> : null}
      {result.items.length > 0 ? <AnnouncementTable jobs={result.items} /> : <Text>{ANNOUNCEMENT_MESSAGES.empty}</Text>}
      <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
    </Stack>
  );
}
