import { formatDate } from "@/shared/lib/dates";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { Text } from "@/shared/ui/Text";
import { CUSTOMER_MESSAGES } from "@/features/users/user.constants";
import type { CustomerActivityRowDTO } from "@/features/users/user.types";

type CustomerActivitySectionProps = {
  activity: CustomerActivityRowDTO[];
};

export function CustomerActivitySection({ activity }: CustomerActivitySectionProps) {
  if (activity.length === 0) return <Text>{CUSTOMER_MESSAGES.noActivity}</Text>;
  return (
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
  );
}
