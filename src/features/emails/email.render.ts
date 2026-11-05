import { render } from "@react-email/components";

// Renders a React Email template into an HTML part and a plain-text part.
export async function renderEmail(element: React.ReactElement): Promise<{ html: string; text: string }> {
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
}
