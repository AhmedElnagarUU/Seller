import { formatDateTime } from "@/shared/lib/dates";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { TextLink } from "@/shared/ui/TextLink";
import type { ActivityLogDTO } from "@/features/activity/activity.types";

type ActivityTableProps = {
  entries: ActivityLogDTO[];
};

export function ActivityTable({ entries }: ActivityTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Date and time</TableHeaderCell>
          <TableHeaderCell>Actor</TableHeaderCell>
          <TableHeaderCell>Summary</TableHeaderCell>
          <TableHeaderCell>Target</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
            <TableCell>{entry.actorLabel}</TableCell>
            <TableCell>{entry.summary}</TableCell>
            <TableCell>{entry.targetPath ? <TextLink href={entry.targetPath}>Open</TextLink> : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
