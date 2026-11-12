import { formatPrice } from "@/shared/lib/money";
import { NOTIFICATION_BODY_MAX, NOTIFICATION_TITLE_MAX } from "@/features/notifications/notification.constants";
import type { NotificationText } from "@/features/notifications/notification.types";

// The text of every in-app notification (docs/09-emails.md section 4). Pure functions.

const ELLIPSIS = "…";
const FIRST_CHANGE_MAX = 200;
const PIASTERS_PER_POUND = 100;

type UpdatedThemeInput = { themeName: string; version: string; changeTexts: string[] };

// A text longer than `max` becomes its first `max - 1` characters and "…", so its length is exactly `max`.
function cutText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}${ELLIPSIS}`;
}

// Cuts the title and the body to the limits of the notification model. The link is never cut.
function toNotificationText(title: string, body: string, link: string | null): NotificationText {
  return { title: cutText(title, NOTIFICATION_TITLE_MAX), body: cutText(body, NOTIFICATION_BODY_MAX), link };
}

// One change: that change. More changes: "<first change> + <n> more".
function buildUpdateBody(changeTexts: string[]): string {
  const [firstChange = "", ...otherChanges] = changeTexts;
  if (otherChanges.length === 0) return firstChange;
  return `${cutText(firstChange, FIRST_CHANGE_MAX)} + ${otherChanges.length} more`;
}

export function buildOwnedThemeUpdatedText({ themeName, version, changeTexts }: UpdatedThemeInput): NotificationText {
  return toNotificationText(`${themeName} ${version} is available`, buildUpdateBody(changeTexts), "/account/themes");
}

export function buildFavoriteThemeUpdatedText({
  themeName,
  themeSlug,
  version,
  changeTexts,
}: UpdatedThemeInput & { themeSlug: string }): NotificationText {
  return toNotificationText(`${themeName} ${version} is out`, buildUpdateBody(changeTexts), `/themes/${themeSlug}`);
}

export function buildCategoryNewThemeText(input: {
  categoryName: string;
  themeName: string;
  themeSlug: string;
  tagline: string;
}): NotificationText {
  return toNotificationText(
    `New in ${input.categoryName}: ${input.themeName}`,
    input.tagline,
    `/themes/${input.themeSlug}`,
  );
}

export function buildAnnouncementText(input: { title: string; body: string; link: string | null }): NotificationText {
  return toNotificationText(input.title, input.body, input.link);
}

export function buildWalletPaymentApprovedText(input: { themeName: string; amountEgp: number }): NotificationText {
  const amount = formatPrice(input.amountEgp * PIASTERS_PER_POUND, "egp");
  return toNotificationText(
    `Payment approved: ${input.themeName}`,
    `Your payment of ${amount} was confirmed. You can download the theme now.`,
    "/account/themes",
  );
}

export function buildWalletPaymentRejectedText(input: {
  themeName: string;
  rejectionReason: string;
  walletPaymentId: string;
}): NotificationText {
  return toNotificationText(
    `Payment not confirmed: ${input.themeName}`,
    `Reason: ${input.rejectionReason}`,
    `/account/wallet-payments/${input.walletPaymentId}`,
  );
}

export function buildFeedbackReplyText(input: { subject: string }): NotificationText {
  return toNotificationText("Reply to your feedback", input.subject, "/account/feedback");
}
