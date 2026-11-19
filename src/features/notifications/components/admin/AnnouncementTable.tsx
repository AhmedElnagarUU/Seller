import { formatDate } from "@/shared/lib/dates";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { Text } from "@/shared/ui/Text";
import { RetryJobButton } from "@/features/notifications/components/admin/RetryJobButton";
import type { AnnouncementJobRowDTO } from "@/features/notifications/announcement.types";
import {
  NOTIFICATION_JOB_STATUS_LABELS,
  type NotificationJobStatus,
} from "@/features/notifications/notification.constants";

type AnnouncementTableProps = {
  jobs: AnnouncementJobRowDTO[];
};

const STATUS_TONES = {
  pending: "neutral",
  running: "primary",
  done: "success",
  failed: "danger",
} as const satisfies Record<NotificationJobStatus, "neutral" | "primary" | "success" | "danger">;

export function AnnouncementTable({ jobs }: AnnouncementTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Title</TableHeaderCell>
          <TableHeaderCell>Audience</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Notified</TableHeaderCell>
          <TableHeaderCell>Emailed</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell>{formatDate(job.createdAt)}</TableCell>
            <TableCell>{job.title}</TableCell>
            <TableCell>{job.audienceLabel}</TableCell>
            <TableCell>
              <Stack gap="xs" align="start">
                <Badge tone={STATUS_TONES[job.status]}>{NOTIFICATION_JOB_STATUS_LABELS[job.status]}</Badge>
                {job.status === "failed" ? (
                  <>
                    {job.error ? (
                      <Text size="sm" tone="danger">
                        {job.error}
                      </Text>
                    ) : null}
                    <RetryJobButton jobId={job.id} />
                  </>
                ) : null}
              </Stack>
            </TableCell>
            <TableCell>{job.notifiedCount}</TableCell>
            <TableCell>{job.emailedCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
