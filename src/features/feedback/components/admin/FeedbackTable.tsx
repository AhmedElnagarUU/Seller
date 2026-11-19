import { formatDate } from "@/shared/lib/dates";
import { Stack } from "@/shared/layout/Stack";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import type { FeedbackAdminListItemDTO } from "@/features/feedback/feedback.types";

type FeedbackTableProps = {
  items: FeedbackAdminListItemDTO[];
};

// The customer is plain text: the customer pages come with a later task.
export function FeedbackTable({ items }: FeedbackTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Customer</TableHeaderCell>
          <TableHeaderCell>Subject</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{formatDate(item.createdAt)}</TableCell>
            <TableCell>
              <Stack gap="xs">
                <Text>{item.customerName}</Text>
                <Text size="sm" tone="muted">
                  {item.customerEmail}
                </Text>
              </Stack>
            </TableCell>
            <TableCell>{item.subject}</TableCell>
            <TableCell>
              <TextLink href={`/admin/feedback/${item.id}`}>Open</TextLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
