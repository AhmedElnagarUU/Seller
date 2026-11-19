import { withTransaction } from "@/shared/db/transaction";
import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import { formatPrice } from "@/shared/lib/money";
import { createDownloadUrl } from "@/shared/storage/s3";
import * as activityService from "@/features/activity/activity.service";
import { sendWalletApprovedEmail, sendWalletRejectedEmail } from "@/features/emails/email.service";
import { createNotification } from "@/features/notifications/notification.service";
import {
  buildWalletPaymentApprovedText,
  buildWalletPaymentRejectedText,
} from "@/features/notifications/notification.texts";
import { recordWalletOrder } from "@/features/orders/order-wallet.service";
import { getUserSummaries, getUserSummary } from "@/features/users/user.service";
import {
  PROOF_VIEW_SECONDS,
  REJECTION_REASON_MAX,
  REJECTION_REASON_MIN,
  WALLET_MESSAGES,
  WALLET_PAYMENTS_PER_PAGE,
  WALLET_TABS,
  type WalletTab,
} from "@/features/wallet-payments/wallet-payment.constants";
import {
  toWalletPaymentAdminDTO,
  toWalletPaymentAdminListItemDTO,
} from "@/features/wallet-payments/wallet-payment.mapper";
import type { WalletPaymentRecord } from "@/features/wallet-payments/wallet-payment.model";
import * as walletPaymentRepository from "@/features/wallet-payments/wallet-payment.repository";
import type { WalletPaymentAdminDTO, WalletPaymentAdminPageDTO } from "@/features/wallet-payments/wallet-payment.types";

const PIASTERS_PER_POUND = 100;

type ReviewInput = { walletPaymentId: string; adminUserId: string };

function amountText(payment: WalletPaymentRecord): string {
  return formatPrice(payment.amountEgp * PIASTERS_PER_POUND, "egp");
}

async function loadPayment(walletPaymentId: string): Promise<WalletPaymentRecord> {
  const payment = await walletPaymentRepository.findWalletPaymentById(walletPaymentId);
  if (!payment) throw new AppError("NOT_FOUND", WALLET_MESSAGES.notFound);
  return payment;
}

// One page of the requests of a tab. Customer name and email come from ONE user query.
export async function listWalletPaymentsForAdmin(input: {
  tab: WalletTab;
  page: number;
}): Promise<WalletPaymentAdminPageDTO> {
  const page = Math.max(1, input.page);
  const status = WALLET_TABS[input.tab];
  const [payments, total] = await Promise.all([
    walletPaymentRepository.findWalletPaymentsByStatus(status, page, WALLET_PAYMENTS_PER_PAGE),
    walletPaymentRepository.countWalletPaymentsByStatus(status),
  ]);
  const customers = await getUserSummaries(payments.map((payment) => payment.userId.toString()));
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  return {
    items: payments.map((payment) =>
      toWalletPaymentAdminListItemDTO(payment, customersById.get(payment.userId.toString())),
    ),
    page,
    totalPages: Math.ceil(total / WALLET_PAYMENTS_PER_PAGE),
    total,
  };
}

// One request for the admin page, or null for an unknown or invalid id. The screenshot link works for 5 minutes (D-104).
export async function getWalletPaymentForAdmin(id: string): Promise<WalletPaymentAdminDTO | null> {
  const payment = await walletPaymentRepository.findWalletPaymentById(id);
  if (!payment) return null;
  const customer = await getUserSummary(payment.userId.toString());
  const proofKey = payment.proof.key ?? null;
  const proofUrl =
    proofKey === null
      ? null
      : await createDownloadUrl({ key: proofKey, expiresInSeconds: PROOF_VIEW_SECONDS, downloadFileName: null });
  return toWalletPaymentAdminDTO(
    payment,
    { id: payment.userId.toString(), name: customer?.name ?? "", email: customer?.email ?? "" },
    proofUrl,
  );
}

// The number on the admin menu badge.
export async function countSubmittedWalletPayments(): Promise<number> {
  return walletPaymentRepository.countWalletPaymentsByStatus("submitted");
}

// Approves a request: order, ownership, notification and log in one transaction (docs/03-data-model.md section 19).
export async function approveWalletPayment(input: ReviewInput): Promise<void> {
  const payment = await loadPayment(input.walletPaymentId);
  const userId = payment.userId.toString();
  await withTransaction(async (session) => {
    const wasReviewed = await walletPaymentRepository.reviewSubmittedWalletPayment(
      input.walletPaymentId,
      { status: "approved", reviewedAt: now(), reviewedByUserId: input.adminUserId, rejectionReason: null },
      session,
    );
    if (!wasReviewed) throw new AppError("CONFLICT", WALLET_MESSAGES.alreadyReviewed);
    const { orderId } = await recordWalletOrder(
      {
        walletPaymentId: input.walletPaymentId,
        userId,
        themeId: payment.themeId.toString(),
        themeName: payment.themeSnapshot.name,
        themeSlug: payment.themeSnapshot.slug,
        amountEgp: payment.amountEgp,
        usdPriceCents: payment.usdPriceCents,
        exchangeRate: payment.exchangeRate,
        couponId: payment.couponId?.toString() ?? null,
        couponCode: payment.couponCode ?? null,
        paidAt: now(),
      },
      session,
    );
    await walletPaymentRepository.setWalletPaymentOrderId(input.walletPaymentId, orderId, session);
    await createNotification(
      {
        userId,
        type: "wallet_payment_approved",
        ...buildWalletPaymentApprovedText({ themeName: payment.themeSnapshot.name, amountEgp: payment.amountEgp }),
      },
      session,
    );
    await activityService.log(
      {
        action: "wallet_payment_approved",
        actorRole: "admin",
        actorUserId: input.adminUserId,
        subjectUserId: userId,
        targetType: "wallet_payment",
        targetId: input.walletPaymentId,
        summary: `Wallet payment approved: ${payment.themeSnapshot.name} (${amountText(payment)})`,
      },
      session,
    );
  });
  try {
    await sendWalletApprovedEmail({ walletPaymentId: input.walletPaymentId });
  } catch (error) {
    console.error("sendWalletApprovedEmail failed", error);
  }
}

function readReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < REJECTION_REASON_MIN || trimmed.length > REJECTION_REASON_MAX) {
    throw new AppError("INVALID", WALLET_MESSAGES.reasonLength);
  }
  return trimmed;
}

// Rejects a request with a reason for the customer. Notification and log are part of the transaction.
export async function rejectWalletPayment(input: ReviewInput & { reason: string }): Promise<void> {
  const rejectionReason = readReason(input.reason);
  const payment = await loadPayment(input.walletPaymentId);
  const userId = payment.userId.toString();
  await withTransaction(async (session) => {
    const wasReviewed = await walletPaymentRepository.reviewSubmittedWalletPayment(
      input.walletPaymentId,
      { status: "rejected", reviewedAt: now(), reviewedByUserId: input.adminUserId, rejectionReason },
      session,
    );
    if (!wasReviewed) throw new AppError("CONFLICT", WALLET_MESSAGES.alreadyReviewed);
    await createNotification(
      {
        userId,
        type: "wallet_payment_rejected",
        ...buildWalletPaymentRejectedText({
          themeName: payment.themeSnapshot.name,
          rejectionReason,
          walletPaymentId: input.walletPaymentId,
        }),
      },
      session,
    );
    await activityService.log(
      {
        action: "wallet_payment_rejected",
        actorRole: "admin",
        actorUserId: input.adminUserId,
        subjectUserId: userId,
        targetType: "wallet_payment",
        targetId: input.walletPaymentId,
        summary: `Wallet payment rejected: ${payment.themeSnapshot.name} (${amountText(payment)})`,
      },
      session,
    );
  });
  try {
    await sendWalletRejectedEmail({ walletPaymentId: input.walletPaymentId });
  } catch (error) {
    console.error("sendWalletRejectedEmail failed", error);
  }
}
