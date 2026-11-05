import { Resend } from "resend";
import { env } from "@/shared/config/env";
import { EmailRateLimitError, type EmailMessage, type EmailSender } from "@/features/emails/email.types";

type ResendFailure = { name: string; statusCode: number | null } | null;

// Throws the right error for a failed Resend answer. Never logs the email body or recipients.
function throwIfFailed(failure: ResendFailure): void {
  if (!failure) return;
  if (failure.statusCode === 429) throw new EmailRateLimitError("EMAIL_RATE_LIMITED");
  throw new Error("EMAIL_SEND_FAILED");
}

function toResendPayload(message: EmailMessage) {
  return {
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: env.SUPPORT_EMAIL,
  };
}

function createResendSender(): EmailSender {
  const resend = new Resend(env.RESEND_API_KEY);
  return {
    async send(message) {
      const { error } = await resend.emails.send(toResendPayload(message));
      throwIfFailed(error);
    },
    async sendBatch(messages, idempotencyKey) {
      const { error } = await resend.batch.send(messages.map(toResendPayload), { idempotencyKey });
      throwIfFailed(error);
    },
  };
}

function printConsoleEmail(message: EmailMessage): void {
  console.warn(`[email] ${message.templateName} to=${message.to} subject=${message.subject}\n${message.text}`);
}

function createConsoleSender(): EmailSender {
  return {
    async send(message) {
      printConsoleEmail(message);
    },
    async sendBatch(messages) {
      messages.forEach(printConsoleEmail);
    },
  };
}

let sender: EmailSender | null = null;

// Resend or console, chosen by env.EMAIL_TRANSPORT. The only file that imports "resend".
export function getEmailSender(): EmailSender {
  sender ??= env.EMAIL_TRANSPORT === "resend" ? createResendSender() : createConsoleSender();
  return sender;
}
