import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { TextLink } from "@/shared/ui/TextLink";

type WaitingForYouProps = {
  walletPaymentsToReview: number;
  newFeedbackCount: number;
};

export function WaitingForYou({ walletPaymentsToReview, newFeedbackCount }: WaitingForYouProps) {
  return (
    <Stack>
      <Heading level={2}>Waiting for you</Heading>
      <TextLink href="/admin/wallet-payments">{`${walletPaymentsToReview} wallet payments to review`}</TextLink>
      <TextLink href="/admin/feedback">{`${newFeedbackCount} new feedback messages`}</TextLink>
    </Stack>
  );
}
