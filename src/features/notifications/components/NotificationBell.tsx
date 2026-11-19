import { Inline } from "@/shared/layout/Inline";
import { Badge } from "@/shared/ui/Badge";
import { TextLink } from "@/shared/ui/TextLink";

type NotificationBellProps = {
  unreadCount: number;
};

// The link to the notification center in the header, with the number of unread notifications.
export function NotificationBell({ unreadCount }: NotificationBellProps) {
  return (
    <Inline gap="xs">
      <TextLink href="/account/notifications">Notifications</TextLink>
      {unreadCount > 0 ? <Badge tone="primary">{unreadCount}</Badge> : null}
    </Inline>
  );
}
