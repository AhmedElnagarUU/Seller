import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { formatDate } from "@/shared/lib/dates";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Text } from "@/shared/ui/Text";
import { openNotificationAction } from "@/features/notifications/notification.actions";
import type { NotificationDTO } from "@/features/notifications/notification.types";

type NotificationListProps = {
  items: NotificationDTO[];
};

// The notifications of one page. Clicking a title marks the notification as read and opens its link.
export function NotificationList({ items }: NotificationListProps) {
  return (
    <Stack>
      {items.map((item) => (
        <Card key={item.id}>
          <Stack gap="sm">
            <Inline gap="sm">
              <form action={openNotificationAction}>
                <input type="hidden" name="id" value={item.id} />
                <Button type="submit" variant="ghost">
                  {item.title}
                </Button>
              </form>
              {item.isRead ? null : <Badge tone="primary">New</Badge>}
            </Inline>
            <Text>{item.body}</Text>
            <Text size="sm" tone="muted">
              {formatDate(item.createdAt)}
            </Text>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
