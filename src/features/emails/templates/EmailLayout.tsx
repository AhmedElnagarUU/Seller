import { Body, Container, Head, Html, Hr, Link, Preview, Section, Text } from "@react-email/components";
import { env } from "@/shared/config/env";

type EmailLayoutProps = {
  preview: string;
  children: React.ReactNode;
};

// Email clients cannot read tokens.css, so colors are written here (the one allowed exception, docs/09 section 2).
const COLORS = { background: "#f4f4f5", card: "#ffffff", text: "#18181b", muted: "#71717a" };

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{ backgroundColor: COLORS.background, fontFamily: "Arial, sans-serif", margin: 0, padding: "24px 0" }}
      >
        <Container
          style={{
            backgroundColor: COLORS.card,
            color: COLORS.text,
            maxWidth: "560px",
            padding: "24px",
            borderRadius: "8px",
          }}
        >
          <Section>
            <Link
              href={env.APP_URL}
              style={{ color: COLORS.text, fontSize: "20px", fontWeight: "bold", textDecoration: "none" }}
            >
              Theme Store
            </Link>
          </Section>
          {children}
          <Hr style={{ borderColor: COLORS.background, margin: "24px 0 12px" }} />
          <Text style={{ color: COLORS.muted, fontSize: "13px", margin: 0 }}>
            {`Questions? Reply to this email or write to ${env.SUPPORT_EMAIL}.`}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const EMAIL_PARAGRAPH_STYLE = { fontSize: "16px", lineHeight: "24px", color: COLORS.text };
export const EMAIL_BUTTON_STYLE = {
  backgroundColor: COLORS.text,
  color: COLORS.card,
  borderRadius: "6px",
  padding: "12px 20px",
  fontSize: "16px",
  textDecoration: "none",
  display: "inline-block",
};
