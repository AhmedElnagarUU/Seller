import { AppError } from "@/shared/errors";
import { env } from "@/shared/config/env";
import { getEmailSender } from "@/features/emails/email.sender";
import { renderEmail } from "@/features/emails/email.render";
import { getOrderForEmail } from "@/features/orders/order.service";
import { OrderConfirmationEmail } from "@/features/emails/templates/OrderConfirmationEmail";
import { ResetPasswordEmail } from "@/features/emails/templates/ResetPasswordEmail";
import { VerifyEmail } from "@/features/emails/templates/VerifyEmail";
import { AdminWalletReviewEmail } from "@/features/emails/templates/AdminWalletReviewEmail";
import { WalletApprovedEmail } from "@/features/emails/templates/WalletApprovedEmail";
import { WalletRejectedEmail } from "@/features/emails/templates/WalletRejectedEmail";
import { getWalletPaymentEmailData } from "@/features/wallet-payments/wallet-payment-email.service";
import { WALLET_MESSAGES } from "@/features/wallet-payments/wallet-payment.constants";
import type { WalletPaymentEmailData } from "@/features/wallet-payments/wallet-payment.types";
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

type WalletEmailInput = { walletPaymentId: string };

async function loadWalletEmailData(walletPaymentId: string): Promise<WalletPaymentEmailData> {
  const data = await getWalletPaymentEmailData(walletPaymentId);
  if (!data) throw new AppError("NOT_FOUND", WALLET_MESSAGES.notFound);
  return data;
}

// Email #4 (docs/09-emails.md section 3.1): the buyer's wallet payment was approved. Call it after the transaction.
export async function sendWalletApprovedEmail({ walletPaymentId }: WalletEmailInput): Promise<void> {
  const data = await loadWalletEmailData(walletPaymentId);
  const { html, text } = await renderEmail(WalletApprovedEmail({ data }));
  await getEmailSender().send({
    to: data.userEmail,
    subject: `Payment approved: ${data.themeName} is yours`,
    html,
    text,
    templateName: "WalletApprovedEmail",
  });
}

// Email #5 (docs/09-emails.md section 3.1): the wallet payment was rejected.
export async function sendWalletRejectedEmail({ walletPaymentId }: WalletEmailInput): Promise<void> {
  const data = await loadWalletEmailData(walletPaymentId);
  const { html, text } = await renderEmail(WalletRejectedEmail({ data }));
  await getEmailSender().send({
    to: data.userEmail,
    subject: `We could not confirm your payment for ${data.themeName}`,
    html,
    text,
    templateName: "WalletRejectedEmail",
  });
}

// Email #6 (docs/09-emails.md section 3.1): tells the owner that a wallet payment waits for review.
export async function sendAdminWalletReviewEmail({ walletPaymentId }: WalletEmailInput): Promise<void> {
  const data = await loadWalletEmailData(walletPaymentId);
  const [adminEmail] = env.ADMIN_EMAILS;
  if (!adminEmail) throw new Error("ADMIN_EMAILS has no address.");
  const { html, text } = await renderEmail(AdminWalletReviewEmail({ data }));
  await getEmailSender().send({
    to: adminEmail,
    subject: `New wallet payment to review: ${data.referenceCode}`,
    html,
    text,
    templateName: "AdminWalletReviewEmail",
  });
}
