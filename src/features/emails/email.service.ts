import { getEmailSender } from "@/features/emails/email.sender";
import { renderEmail } from "@/features/emails/email.render";
import { ResetPasswordEmail } from "@/features/emails/templates/ResetPasswordEmail";
import { VerifyEmail } from "@/features/emails/templates/VerifyEmail";

type AuthEmailInput = {
  to: string;
  name: string;
  url: string;
};

// Email #1 (docs/09-emails.md section 3.1): confirm the email address.
export async function sendVerifyEmail({ to, name, url }: AuthEmailInput): Promise<void> {
  const { html, text } = await renderEmail(VerifyEmail({ name, url }));
  await getEmailSender().send({ to, subject: "Confirm your email address", html, text, templateName: "VerifyEmail" });
}

// Email #2 (docs/09-emails.md section 3.1): reset the password.
export async function sendResetPasswordEmail({ to, name, url }: AuthEmailInput): Promise<void> {
  const { html, text } = await renderEmail(ResetPasswordEmail({ name, url }));
  await getEmailSender().send({ to, subject: "Reset your password", html, text, templateName: "ResetPasswordEmail" });
}
