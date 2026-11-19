import { formatDate } from "@/shared/lib/dates";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/shared/ui/Table";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { FEEDBACK_ADMIN_STATUS_LABELS } from "@/features/feedback/feedback.constants";
import { CUSTOMER_MESSAGES } from "@/features/users/user.constants";
import type { CustomerFeedbackRowDTO } from "@/features/users/user.types";

type CustomerFeedbackSectionProps = {
  feedback: CustomerFeedbackRowDTO[];
};

export function CustomerFeedbackSection({ feedback }: CustomerFeedbackSectionProps) {
  if (feedback.length === 0) return <Text>{CUSTOMER_MESSAGES.noFeedback}</Text>;
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Subject</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {feedback.map((message) => (
          <TableRow key={message.id}>
            <TableCell>{formatDate(message.createdAt)}</TableCell>
            <TableCell>
              <TextLink href={`/admin/feedback/${message.id}`}>{message.subject}</TextLink>
            </TableCell>
            <TableCell>{FEEDBACK_ADMIN_STATUS_LABELS[message.status]}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
