import type { Metadata } from "next";
import { z } from "zod";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Pagination } from "@/shared/ui/Pagination";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import { Text } from "@/shared/ui/Text";
import { requireUser } from "@/features/auth/session";
import { NotificationList } from "@/features/notifications/components/NotificationList";
import { markAllNotificationsReadAction } from "@/features/notifications/notification.actions";
import { listNotifications } from "@/features/notifications/notification.service";

export const metadata: Metadata = {
  title: "Notifications · Theme Store",
  robots: { index: false },
};

const searchParamsSchema = z.object({ page: z.coerce.number().int().min(1).catch(1) });

type NotificationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildHref(page: number): string {
  return page > 1 ? `/account/notifications?page=${page}` : "/account/notifications";
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const user = await requireUser("/account/notifications");
  const { page } = searchParamsSchema.parse(await searchParams);
  const result = await listNotifications(user.id, page);

  return (
    <Stack>
      <Heading level={1}>Notifications</Heading>
      {result.unreadCount > 0 ? (
        <form action={markAllNotificationsReadAction}>
          <SubmitButton variant="secondary" pendingText="Marking…">
            Mark all as read
          </SubmitButton>
        </form>
      ) : null}
      {result.items.length > 0 ? <NotificationList items={result.items} /> : <Text>No notifications yet.</Text>}
      <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
    </Stack>
  );
}
