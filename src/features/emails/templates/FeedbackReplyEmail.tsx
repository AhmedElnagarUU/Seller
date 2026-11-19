import { Button, Section, Text } from "@react-email/components";
import { env } from "@/shared/config/env";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/features/emails/templates/EmailLayout";
import type { FeedbackEmailData } from "@/features/feedback/feedback.types";

type FeedbackReplyEmailProps = {
  data: FeedbackEmailData;
};

// Email #11 of docs/09-emails.md section 3.1. The reply is plain text: one paragraph per line.
export function FeedbackReplyEmail({ data }: FeedbackReplyEmailProps) {
  const lines = data.reply.split("\n").filter((line) => line.trim() !== "");
  return (
    <EmailLayout preview={`Reply to your feedback: ${data.subject}`}>
      <Text style={EMAIL_PARAGRAPH_STYLE}>{`Hi ${data.userName},`}</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        We replied to your feedback &quot;<strong>{data.subject}</strong>&quot;:
      </Text>
      {lines.map((line, index) => (
        <Text key={`${index}-${line}`} style={EMAIL_PARAGRAPH_STYLE}>
          {line}
        </Text>
      ))}
      <Section>
        <Button href={`${env.APP_URL}/account/feedback`} style={EMAIL_BUTTON_STYLE}>
          View feedback
        </Button>
      </Section>
    </EmailLayout>
  );
}
