import { formatDate } from "@/shared/lib/dates";
import { formatMegabytes } from "@/shared/lib/files";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { NOTIFICATION_JOB_STATUS_LABELS } from "@/features/notifications/notification.constants";
import type { NotificationJobSummaryDTO } from "@/features/notifications/notification.types";
import { CopyTextButton } from "@/features/versions/components/admin/CopyTextButton";
import type { VersionAdminListItemDTO } from "@/features/versions/version.types";

const SHA256_PREVIEW_LENGTH = 12;

type VersionListProps = {
  themeId: string;
  versions: VersionAdminListItemDTO[];
};

const STATUS_TONES = {
  pending: "neutral",
  running: "primary",
  done: "success",
  failed: "danger",
} as const;

function NotificationCell({ notification }: { notification: NotificationJobSummaryDTO | null }) {
  if (!notification) return <>—</>;
  return (
    <Stack gap="xs">
      <div>
        <Badge tone={STATUS_TONES[notification.status]}>{NOTIFICATION_JOB_STATUS_LABELS[notification.status]}</Badge>
      </div>
      <Text size="sm">
        {notification.notifiedCount} notified, {notification.emailedCount} emailed
      </Text>
      {notification.error ? <Text size="sm">{notification.error}</Text> : null}
    </Stack>
  );
}

export function VersionList({ themeId, versions }: VersionListProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Version</TableHeaderCell>
          <TableHeaderCell>Released</TableHeaderCell>
          <TableHeaderCell>Size</TableHeaderCell>
          <TableHeaderCell>SHA-256</TableHeaderCell>
          <TableHeaderCell>Notifications</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {versions.map((version) => (
          <TableRow key={version.id}>
            <TableCell>{version.version}</TableCell>
            <TableCell>{formatDate(version.releasedAt)}</TableCell>
            <TableCell>{formatMegabytes(version.sizeBytes)}</TableCell>
            <TableCell>
              <Inline gap="sm">
                <span>{version.sha256.slice(0, SHA256_PREVIEW_LENGTH)}</span>
                <CopyTextButton text={version.sha256} />
              </Inline>
            </TableCell>
            <TableCell>
              <NotificationCell notification={version.notification} />
            </TableCell>
            <TableCell>
              <TextLink href={`/admin/themes/${themeId}/versions/${version.id}`}>Edit changelog</TextLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
