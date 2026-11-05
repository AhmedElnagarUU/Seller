import { Button, Section, Text } from "@react-email/components";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/features/emails/templates/EmailLayout";

type ResetPasswordEmailProps = {
  name: string;
  url: string;
};

export function ResetPasswordEmail({ name, url }: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview="Reset your password.">
      <Text style={EMAIL_PARAGRAPH_STYLE}>{`Hi ${name},`}</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        We received a request to reset your password. This link works for 1 hour.
      </Text>
      <Section>
        <Button href={url} style={EMAIL_BUTTON_STYLE}>
          Reset password
        </Button>
      </Section>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        If you did not ask for this, you can ignore this email. Your password stays the same.
      </Text>
    </EmailLayout>
  );
}
