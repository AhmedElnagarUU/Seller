import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDate } from "@/shared/lib/dates";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Card } from "@/shared/ui/Card";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { requireAdmin } from "@/features/auth/session";
import { ReplyForm } from "@/features/feedback/components/admin/ReplyForm";
import { ResolveButton } from "@/features/feedback/components/admin/ResolveButton";
import { FEEDBACK_ADMIN_STATUS_LABELS } from "@/features/feedback/feedback.constants";
import { openFeedbackForAdmin } from "@/features/feedback/feedback.service";

export const metadata: Metadata = {
  title: "Feedback · Theme Store",
  robots: { index: false },
};

type AdminFeedbackDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminFeedbackDetailPage({ params }: AdminFeedbackDetailPageProps) {
  await requireAdmin();
  const { id } = await params;
  const feedback = await openFeedbackForAdmin(id);
  if (!feedback) notFound();

  return (
    <Stack gap="lg">
      <Inline>
        <Heading level={1}>{feedback.subject}</Heading>
        <Badge>{FEEDBACK_ADMIN_STATUS_LABELS[feedback.status]}</Badge>
      </Inline>
      <Stack gap="xs">
        <Text>{`Customer: ${feedback.customer.name} (${feedback.customer.email})`}</Text>
        <Text size="sm" tone="muted">
          {formatDate(feedback.createdAt)}
        </Text>
      </Stack>
      <Text preserveLines>{feedback.message}</Text>
      {feedback.reply ? (
        <Card>
          <Stack>
            <Heading level={3}>Your reply</Heading>
            <Text preserveLines>{feedback.reply}</Text>
            {feedback.repliedAt ? (
              <Text size="sm" tone="muted">
                {formatDate(feedback.repliedAt)}
              </Text>
            ) : null}
          </Stack>
        </Card>
      ) : null}
      <ReplyForm feedbackId={feedback.id} hasReply={feedback.reply !== null} />
      <ResolveButton feedbackId={feedback.id} status={feedback.status} />
    </Stack>
  );
}
