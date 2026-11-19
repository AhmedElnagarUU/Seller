import { Inline } from "@/shared/layout/Inline";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import {
  FEEDBACK_ADMIN_STATUS_LABELS,
  FEEDBACK_STATUSES,
  type FeedbackStatus,
} from "@/features/feedback/feedback.constants";

type FeedbackTabsProps = {
  current: FeedbackStatus;
};

export function FeedbackTabs({ current }: FeedbackTabsProps) {
  return (
    <Inline gap="sm" wrap>
      {FEEDBACK_STATUSES.map((tab) => (
        <ButtonLink
          key={tab}
          href={`/admin/feedback?tab=${tab}`}
          size="sm"
          variant={tab === current ? "primary" : "secondary"}
        >
          {FEEDBACK_ADMIN_STATUS_LABELS[tab]}
        </ButtonLink>
      ))}
    </Inline>
  );
}
