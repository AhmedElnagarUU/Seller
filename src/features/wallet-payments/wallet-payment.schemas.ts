import { z } from "zod";
import { OBJECT_ID_PATTERN, THEME_SLUG_PATTERN } from "@/features/themes/theme.constants";
import {
  EGYPT_MOBILE_PATTERN,
  REJECTION_REASON_MAX,
  REJECTION_REASON_MIN,
  TRANSACTION_ID_MAX,
  WALLET_MESSAGES,
  WALLET_TABS,
} from "@/features/wallet-payments/wallet-payment.constants";

const PROOF_KEY_MAX = 300;
const COUPON_MAX = 64;

const idField = z.string().regex(OBJECT_ID_PATTERN);

// The hidden fields of the "Pay with wallet" form. "" means no coupon.
export const startWalletPaymentSchema = z.object({
  slug: z.string().regex(THEME_SLUG_PATTERN),
  coupon: z
    .string()
    .trim()
    .transform((value) => value.slice(0, COUPON_MAX))
    .transform((value) => (value === "" ? null : value)),
});

export const createProofUploadUrlSchema = z.object({
  walletPaymentId: idField,
  contentType: z.string(),
  sizeBytes: z.number(),
});

export const submitWalletProofSchema = z.object({
  walletPaymentId: idField,
  senderPhone: z.string().trim().regex(EGYPT_MOBILE_PATTERN, WALLET_MESSAGES.phone),
  transactionId: z.string().trim().max(TRANSACTION_ID_MAX, WALLET_MESSAGES.transactionIdLength),
  proofKey: z.string().min(1).max(PROOF_KEY_MAX),
});

export const walletPaymentIdSchema = z.object({ id: idField });

export const rejectWalletPaymentSchema = z.object({
  id: idField,
  reason: z
    .string()
    .trim()
    .min(REJECTION_REASON_MIN, WALLET_MESSAGES.reasonLength)
    .max(REJECTION_REASON_MAX, WALLET_MESSAGES.reasonLength),
});

// The query of /admin/wallet-payments. A bad value falls back to the "review" tab and page 1.
export const walletPaymentsSearchParamsSchema = z.object({
  tab: z.enum(Object.keys(WALLET_TABS) as [keyof typeof WALLET_TABS, ...(keyof typeof WALLET_TABS)[]]).catch("review"),
  page: z.coerce.number().int().min(1).catch(1),
});
