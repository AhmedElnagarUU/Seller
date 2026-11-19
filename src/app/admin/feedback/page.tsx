import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Pagination } from "@/shared/ui/Pagination";
import { Text } from "@/shared/ui/Text";
import { requireAdmin } from "@/features/auth/session";
import { FeedbackTable } from "@/features/feedback/components/admin/FeedbackTable";
import { FeedbackTabs } from "@/features/feedback/components/admin/FeedbackTabs";
import { FEEDBACK_MESSAGES, type FeedbackStatus } from "@/features/feedback/feedback.constants";
import { feedbackSearchParamsSchema } from "@/features/feedback/feedback.schemas";
import { listFeedbackForAdmin } from "@/features/feedback/feedback.service";

export const metadata: Metadata = {
  title: "Feedback · Theme Store",
  robots: { index: false },
};

type AdminFeedbackPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildHref(tab: FeedbackStatus, page: number): string {
  const params = new URLSearchParams({ tab });
  if (page > 1) params.set("page", String(page));
  return `/admin/feedback?${params.toString()}`;
}

export default async function AdminFeedbackPage({ searchParams }: AdminFeedbackPageProps) {
  await requireAdmin();
  const { tab, page } = feedbackSearchParamsSchema.parse(await searchParams);
  const result = await listFeedbackForAdmin({ status: tab, page });

  return (
    <Stack>
      <Heading level={1}>Feedback</Heading>
      <FeedbackTabs current={tab} />
      {result.items.length > 0 ? <FeedbackTable items={result.items} /> : <Text>{FEEDBACK_MESSAGES.adminEmpty}</Text>}
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        buildHref={(targetPage) => buildHref(tab, targetPage)}
      />
    </Stack>
  );
}
