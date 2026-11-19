import { Button, Section, Text } from "@react-email/components";
import { env } from "@/shared/config/env";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/features/emails/templates/EmailLayout";

type NewThemeInCategoryEmailProps = {
  name: string;
  categoryName: string;
  themeName: string;
  themeSlug: string;
  tagline: string;
};

// Email #9 of docs/09-emails.md section 3.1.
export function NewThemeInCategoryEmail({
  name,
  categoryName,
  themeName,
  themeSlug,
  tagline,
}: NewThemeInCategoryEmailProps) {
  return (
    <EmailLayout preview={`New in ${categoryName}: ${themeName}`} reason={`you follow ${categoryName}`}>
      <Text style={EMAIL_PARAGRAPH_STYLE}>{`Hi ${name},`}</Text>
      <Text style={EMAIL_PARAGRAPH_STYLE}>
        A new theme was just added to <strong>{categoryName}</strong>: <strong>{themeName}</strong>
        {`: ${tagline}`}
      </Text>
      <Section>
        <Button href={`${env.APP_URL}/themes/${themeSlug}`} style={EMAIL_BUTTON_STYLE}>
          See the theme
        </Button>
      </Section>
    </EmailLayout>
  );
}
