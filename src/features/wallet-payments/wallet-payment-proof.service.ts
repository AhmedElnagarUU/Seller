import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import { formatPrice } from "@/shared/lib/money";
import {
  IMAGE_CONTENT_TYPES,
  newWalletProofKey,
  walletProofPrefix,
  type ImageContentType,
} from "@/shared/storage/keys";
import { createUploadUrl, headObject, type PresignedUpload } from "@/shared/storage/s3";
import * as activityService from "@/features/activity/activity.service";
import { sendAdminWalletReviewEmail } from "@/features/emails/email.service";
import {
  EGYPT_MOBILE_PATTERN,
  MAX_PROOF_BYTES,
  PROOF_UPLOAD_SECONDS,
  TRANSACTION_ID_MAX,
  WALLET_MESSAGES,
} from "@/features/wallet-payments/wallet-payment.constants";
import type { WalletPaymentRecord } from "@/features/wallet-payments/wallet-payment.model";
import * as walletPaymentRepository from "@/features/wallet-payments/wallet-payment.repository";

type CreateProofUploadUrlInput = { userId: string; walletPaymentId: string; contentType: string; sizeBytes: number };

type SubmitWalletProofInput = {
  userId: string;
  walletPaymentId: string;
  senderPhone: string;
  transactionId: string;
  proofKey: string;
};

function isImageContentType(contentType: string): contentType is ImageContentType {
  return IMAGE_CONTENT_TYPES.some((allowed) => allowed === contentType);
}

function isProofSize(sizeBytes: number): boolean {
  return Number.isInteger(sizeBytes) && sizeBytes >= 1 && sizeBytes <= MAX_PROOF_BYTES;
}

// The request of this user that is still waiting for payment. Anything else is an error.
async function loadChangeablePayment(userId: string, walletPaymentId: string): Promise<WalletPaymentRecord> {
  const payment = await walletPaymentRepository.findWalletPaymentForUser(userId, walletPaymentId);
  if (!payment) throw new AppError("NOT_FOUND", WALLET_MESSAGES.notFound);
  if (payment.status !== "awaiting_payment") throw new AppError("CONFLICT", WALLET_MESSAGES.notChangeable);
  return payment;
}

// A presigned upload for the screenshot of the transfer, in the private bucket (docs/06-payments.md section 7.5).
export async function createProofUploadUrl(input: CreateProofUploadUrlInput): Promise<PresignedUpload> {
  await loadChangeablePayment(input.userId, input.walletPaymentId);
  if (!isImageContentType(input.contentType) || !isProofSize(input.sizeBytes)) {
    throw new AppError("INVALID", WALLET_MESSAGES.proofType);
  }
  return createUploadUrl({
    bucket: "private",
    key: newWalletProofKey(input.walletPaymentId, input.contentType),
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    cacheControl: null,
    expiresInSeconds: PROOF_UPLOAD_SECONDS,
  });
}

// "" means no transaction id.
function readTransactionId(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length > TRANSACTION_ID_MAX) throw new AppError("INVALID", WALLET_MESSAGES.transactionIdLength);
  return trimmed === "" ? null : trimmed;
}

// The stored screenshot of this request, checked with a HEAD request.
async function findStoredProof(
  walletPaymentId: string,
  proofKey: string,
): Promise<{ key: string; contentType: ImageContentType; sizeBytes: number }> {
  const missing = new AppError("INVALID", WALLET_MESSAGES.proofMissing);
  if (!proofKey.startsWith(walletProofPrefix(walletPaymentId))) throw missing;
  const stored = await headObject({ bucket: "private", key: proofKey });
  if (stored === null || !isImageContentType(stored.contentType) || !isProofSize(stored.sizeBytes)) throw missing;
  return { key: proofKey, contentType: stored.contentType, sizeBytes: stored.sizeBytes };
}

// The customer sends the transfer details and the screenshot (docs/06-payments.md section 7.5).
export async function submitWalletProof(input: SubmitWalletProofInput): Promise<void> {
  const payment = await loadChangeablePayment(input.userId, input.walletPaymentId);
  if (!EGYPT_MOBILE_PATTERN.test(input.senderPhone)) throw new AppError("INVALID", WALLET_MESSAGES.phone);
  const transactionId = readTransactionId(input.transactionId);
  const proof = await findStoredProof(input.walletPaymentId, input.proofKey);
  const wasSubmitted = await walletPaymentRepository.submitAwaitingWalletPayment(input.userId, input.walletPaymentId, {
    senderPhone: input.senderPhone,
    transactionId,
    proof,
    submittedAt: now(),
  });
  if (!wasSubmitted) throw new AppError("CONFLICT", WALLET_MESSAGES.notChangeable);
  await activityService.log({
    action: "wallet_payment_submitted",
    actorRole: "customer",
    actorUserId: input.userId,
    subjectUserId: input.userId,
    targetType: "wallet_payment",
    targetId: input.walletPaymentId,
    summary: `Wallet payment submitted: ${payment.themeSnapshot.name} (${formatPrice(payment.amountEgp * 100, "egp")})`,
  });
  try {
    await sendAdminWalletReviewEmail({ walletPaymentId: input.walletPaymentId });
  } catch (error) {
    console.error("sendAdminWalletReviewEmail failed", error);
  }
}
