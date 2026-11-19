import { Button, Section, Text } from "@react-email/components";
import { env } from "@/shared/config/env";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/features/emails/templates/EmailLayout";

type AnnouncementEmailProps = {
  name: string;
  title: string;
  body: string;
  link: string | null;
};

// Email #10 of docs/09-emails.md section 3.1. The body is plain text: one paragraph per line.
export function AnnouncementEmail({ name, title, body, link }: AnnouncementEmailProps) {
  const lines = body.split("\n").filter((line) => line.trim() !== "");
  return (
    <EmailLayout preview={title} reason="you are a customer of Theme Store">
      <Text style={EMAIL_PARAGRAPH_STYLE}>{`Hi ${name},`}</Text>
      {lines.map((line, index) => (
        <Text key={`${index}-${line}`} style={EMAIL_PARAGRAPH_STYLE}>
          {line}
        </Text>
      ))}
      {link ? (
        <Section>
          <Button href={env.APP_URL + link} style={EMAIL_BUTTON_STYLE}>
            Learn more
          </Button>
        </Section>
      ) : null}
    </EmailLayout>
  );
}
