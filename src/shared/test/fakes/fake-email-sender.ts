import type { EmailMessage, EmailSender } from "@/features/emails/email.types";

export type SentEmail = EmailMessage & { idempotencyKey: string | null };

// Test double for the email sender (docs/10-testing.md section 4). Records emails instead of sending them.
export class FakeEmailSender implements EmailSender {
  sent: SentEmail[] = [];
  private nextError: Error | null = null;

  async send(message: EmailMessage): Promise<void> {
    this.throwIfFailureIsQueued();
    this.sent.push({ ...message, idempotencyKey: null });
  }

  async sendBatch(messages: EmailMessage[], idempotencyKey: string): Promise<void> {
    this.throwIfFailureIsQueued();
    for (const message of messages) {
      this.sent.push({ ...message, idempotencyKey });
    }
  }

  // The next send or sendBatch call throws this error.
  failNext(error: Error): void {
    this.nextError = error;
  }

  reset(): void {
    this.sent = [];
    this.nextError = null;
  }

  private throwIfFailureIsQueued(): void {
    if (!this.nextError) return;
    const error = this.nextError;
    this.nextError = null;
    throw error;
  }
}

// The one shared instance that getEmailSender() returns in tests.
export const fakeEmailSender = new FakeEmailSender();
