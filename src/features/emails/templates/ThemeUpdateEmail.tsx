import { Button, Section, Text } from "@react-email/components";
import { env } from "@/shared/config/env";
import { formatDate } from "@/shared/lib/dates";
import { EMAIL_BUTTON_STYLE, EMAIL_PARAGRAPH_STYLE, EmailLayout } from "@/features/emails/templates/EmailLayout";

type CommonProps = { name: string; themeName: string; version: string; changeLines: string[] };

// "owner": email #7, the customer owns the theme. "favorite": email #8, the customer favorited it.
type ThemeUpdateEmailProps =
  (CommonProps & { variant: "owner"; releasedAt: Date }) | (CommonProps & { variant: "favorite"; themeSlug: string });

// Emails #7 and #8 of docs/09-emails.md section 3.1.
export function ThemeUpdateEmail(props: ThemeUpdateEmailProps) {
  const { name, themeName, version, changeLines } = props;
  const isOwner = props.variant === "owner";
  return (
    <EmailLayout
      preview={`${themeName} ${version} is ${isOwner ? "available" : "out"}.`}
      reason={isOwner ? `you own ${themeName}` : `you favorited ${themeName}`}
    >
      <Text style={EMAIL_PARAGRAPH_STYLE}>{`Hi ${name},`}</Text>
      {props.variant === "owner" ? (
        <Text style={EMAIL_PARAGRAPH_STYLE}>
          A new version of <strong>{themeName}</strong> is ready: <strong>{version}</strong>
          {` (${formatDate(props.releasedAt)}).`}
        </Text>
      ) : (
        <Text style={EMAIL_PARAGRAPH_STYLE}>
          <strong>{themeName}</strong>, a theme you favorited, has a new version: <strong>{version}</strong>.
        </Text>
      )}
      <Text style={EMAIL_PARAGRAPH_STYLE}>What changed:</Text>
      {changeLines.map((line, index) => (
        <Text key={`${index}-${line}`} style={{ ...EMAIL_PARAGRAPH_STYLE, margin: "0 0 4px" }}>
          {line}
        </Text>
      ))}
      <Section>
        <Button
          href={env.APP_URL + (props.variant === "owner" ? "/account/themes" : `/themes/${props.themeSlug}`)}
          style={EMAIL_BUTTON_STYLE}
        >
          {isOwner ? "Download the update" : "See the theme"}
        </Button>
      </Section>
    </EmailLayout>
  );
}
