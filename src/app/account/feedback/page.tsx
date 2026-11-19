import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { requireUser } from "@/features/auth/session";
import { FeedbackForm } from "@/features/feedback/components/FeedbackForm";
import { FeedbackList } from "@/features/feedback/components/FeedbackList";
import { listFeedbackForUser } from "@/features/feedback/feedback.service";

export const metadata: Metadata = {
  title: "Feedback · Theme Store",
  robots: { index: false },
};

export default async function AccountFeedbackPage() {
  const user = await requireUser("/account/feedback");
  const feedback = await listFeedbackForUser(user.id);

  return (
    <Stack gap="lg">
      <Heading level={1}>Feedback</Heading>
      <FeedbackForm />
      <FeedbackList feedback={feedback} />
    </Stack>
  );
}
