import { formatDate } from "@/shared/lib/dates";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { Text } from "@/shared/ui/Text";
import { DASHBOARD_MESSAGES } from "@/features/orders/dashboard.constants";
import type { DashboardDTO } from "@/features/orders/dashboard.types";

type LatestActivityProps = {
  activity: DashboardDTO["latestActivity"];
};

export function LatestActivity({ activity }: LatestActivityProps) {
  return (
    <Stack>
      <Heading level={2}>Latest activity</Heading>
      {activity.length === 0 ? (
        <Text>{DASHBOARD_MESSAGES.noActivity}</Text>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Summary</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activity.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.createdAt)}</TableCell>
                <TableCell>{row.summary}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}
