export type EmailMessage = {
  to: string; // one address
  subject: string;
  html: string;
  text: string;
  templateName: string; // e.g. "ThemeUpdateEmail" — for logs and FakeEmailSender
};

export interface EmailSender {
  // Sends one email. Throws on failure.
  send(message: EmailMessage): Promise<void>;
  // Sends up to 100 emails in ONE request. idempotencyKey makes a retry with the same key send nothing twice.
  sendBatch(messages: EmailMessage[], idempotencyKey: string): Promise<void>;
}

// Thrown when the provider answers 429.
export class EmailRateLimitError extends Error {}
