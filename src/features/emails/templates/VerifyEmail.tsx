import { Button, Section, Text } from "@react-email/components";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/features/emails/templates/EmailLayout";

type VerifyEmailProps = {
  name: string;
  url: string;
};

export function VerifyEmail({ name, url }: VerifyEmailProps) {
  return (
    <EmailLayout preview="Please confirm your email address.">
      <Text style={EMAIL_PARAGRAPH_STYLE}>{`Hi ${name},`}</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>Please confirm your email address to finish creating your account.</Text>
      <Section>
        <Button href={url} style={EMAIL_BUTTON_STYLE}>
          Confirm email
        </Button>
      </Section>
      <Text style={EMAIL_PARAGRAPH_STYLE}>If you did not create an account, you can ignore this email.</Text>
    </EmailLayout>
  );
}
