import { formatDate } from "@/shared/lib/dates";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Card } from "@/shared/ui/Card";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import {
  FEEDBACK_CUSTOMER_STATUS_LABELS,
  FEEDBACK_MESSAGES,
  type FeedbackStatus,
} from "@/features/feedback/feedback.constants";
import type { FeedbackDTO } from "@/features/feedback/feedback.types";

type FeedbackListProps = {
  feedback: FeedbackDTO[];
};

const STATUS_TONES: Record<FeedbackStatus, "neutral" | "primary" | "success"> = {
  new: "neutral",
  read: "primary",
  resolved: "success",
};

export function FeedbackList({ feedback }: FeedbackListProps) {
  if (feedback.length === 0) return <Text>{FEEDBACK_MESSAGES.customerEmpty}</Text>;
  return (
    <Stack>
      {feedback.map((item) => (
        <Card key={item.id}>
          <Stack>
            <Inline justify="between" wrap>
              <Heading level={3}>{item.subject}</Heading>
              <Badge tone={STATUS_TONES[item.status]}>{FEEDBACK_CUSTOMER_STATUS_LABELS[item.status]}</Badge>
            </Inline>
            <Text size="sm" tone="muted">
              {formatDate(item.createdAt)}
            </Text>
            <Text preserveLines>{item.message}</Text>
            {item.reply ? (
              <Card>
                <Stack>
                  <Heading level={3}>Our reply</Heading>
                  <Text preserveLines>{item.reply}</Text>
                </Stack>
              </Card>
            ) : null}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
