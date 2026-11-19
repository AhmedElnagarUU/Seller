import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { IMAGE_CONTENT_TYPES } from "@/shared/storage/keys";
import {
  EGYPT_MOBILE_PATTERN,
  MAX_PROOF_BYTES,
  REJECTION_REASON_MAX,
  REJECTION_REASON_MIN,
  TRANSACTION_ID_MAX,
  WALLET_PAYMENT_STATUSES,
  WALLET_REFERENCE_PATTERN,
} from "@/features/wallet-payments/wallet-payment.constants";

const RATE_MIN = 1;
const RATE_MAX = 1000;

// The name and slug of the theme when the request was made.
const themeSnapshotSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
  },
  { _id: false },
);

function isIntegerOrNull(value: number | null): boolean {
  return value === null || Number.isInteger(value);
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.round(value * 100) / 100 === value;
}

// The screenshot of the transfer in the private bucket. All null until the customer submits it.
const proofSchema = new Schema(
  {
    key: { type: String, default: null },
    contentType: { type: String, default: null, enum: [...IMAGE_CONTENT_TYPES, null] },
    sizeBytes: { type: Number, default: null, min: 1, max: MAX_PROOF_BYTES, validate: isIntegerOrNull },
  },
  { _id: false },
);

// A customer's request to buy a theme by Egyptian wallet transfer (docs/03-data-model.md section 10).
const walletPaymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true },
    themeSnapshot: { type: themeSnapshotSchema, required: true },
    // "TS-" and 6 characters. Written in the transfer note.
    referenceCode: { type: String, required: true, match: WALLET_REFERENCE_PATTERN },
    status: { type: String, required: true, enum: WALLET_PAYMENT_STATUSES },
    // true while the status is "awaiting_payment" or "submitted".
    isOpen: { type: Boolean, required: true },
    usdPriceCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
    usdDiscountCents: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", default: null },
    couponCode: { type: String, default: null, trim: true },
    // USD → EGP rate used, copied from the settings.
    exchangeRate: { type: Number, required: true, min: RATE_MIN, max: RATE_MAX, validate: hasAtMostTwoDecimals },
    // Whole pounds.
    amountEgp: { type: Number, required: true, min: 1, validate: Number.isInteger },
    senderPhone: { type: String, default: null, match: EGYPT_MOBILE_PATTERN },
    transactionId: { type: String, default: null, trim: true, maxlength: TRANSACTION_ID_MAX },
    proof: { type: proofSchema, required: true, default: () => ({}) },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
      minlength: REJECTION_REASON_MIN,
      maxlength: REJECTION_REASON_MAX,
    },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { collection: "walletPayments", timestamps: true },
);

walletPaymentSchema.index({ referenceCode: 1 }, { unique: true });
// At most one open request per user and theme.
walletPaymentSchema.index({ userId: 1, themeId: 1 }, { unique: true, partialFilterExpression: { isOpen: true } });
// The review queue, oldest first.
walletPaymentSchema.index({ status: 1, submittedAt: 1 });
walletPaymentSchema.index({ userId: 1, createdAt: -1 });

export type WalletPaymentRecord = InferSchemaType<typeof walletPaymentSchema> & { _id: Types.ObjectId };

// `models.WalletPayment ||` stops hot reload from defining the model twice.
export const WalletPaymentModel =
  (models.WalletPayment as Model<WalletPaymentRecord>) ||
  model<WalletPaymentRecord>("WalletPayment", walletPaymentSchema);
