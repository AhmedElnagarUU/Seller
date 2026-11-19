import { AppError } from "@/shared/errors";
import { getEmailSender } from "@/features/emails/email.sender";
import { renderEmail } from "@/features/emails/email.render";
import { getOrderForEmail } from "@/features/orders/order.service";
import { OrderConfirmationEmail } from "@/features/emails/templates/OrderConfirmationEmail";
import { ResetPasswordEmail } from "@/features/emails/templates/ResetPasswordEmail";
import { VerifyEmail } from "@/features/emails/templates/VerifyEmail";
import { getUserSummary } from "@/features/users/user.service";

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

// Email #3 (docs/09-emails.md section 3.1): the buyer's order confirmation. Call it after the order transaction.
export async function sendOrderConfirmationEmail({ orderId }: { orderId: string }): Promise<void> {
  const order = await getOrderForEmail(orderId);
  if (!order) throw new AppError("NOT_FOUND", "Order not found.");
  const user = await getUserSummary(order.userId);
  if (!user) throw new AppError("NOT_FOUND", "Order not found.");
  const { html, text } = await renderEmail(OrderConfirmationEmail({ name: user.name, order }));
  await getEmailSender().send({
    to: user.email,
    subject: `Your purchase: ${order.themeName}`,
    html,
    text,
    templateName: "OrderConfirmationEmail",
  });
}
