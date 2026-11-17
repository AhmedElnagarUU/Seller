import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import {
  AMOUNT_OFF_MAX_CENTS,
  AMOUNT_OFF_MIN_CENTS,
  COUPON_APPLIES_TO,
  COUPON_CODE_PATTERN,
  COUPON_TYPES,
  MAX_COUPON_THEMES,
  PERCENT_OFF_MAX,
  PERCENT_OFF_MIN,
} from "@/features/coupons/coupon.constants";

// Link to the payment provider's discount.
const providerSchema = new Schema(
  {
    // Matching discount id at the payment provider.
    discountId: { type: String, default: null },
    // Last successful sync to the payment provider.
    syncedAt: { type: Date, default: null },
  },
  { _id: false },
);

function isIntegerOrNull(value: number | null): boolean {
  return value === null || Number.isInteger(value);
}

function hasAtMostThemes(themeIds: unknown[]): boolean {
  return themeIds.length <= MAX_COUPON_THEMES;
}

const couponSchema = new Schema(
  {
    // Uppercase code, e.g. "SAVE20". Unique. The service or schema uppercases it first.
    code: { type: String, required: true, match: COUPON_CODE_PATTERN },
    type: { type: String, required: true, enum: COUPON_TYPES },
    // 1 to 100. Set when type is "percent", else null.
    percentOff: { type: Number, default: null, min: PERCENT_OFF_MIN, max: PERCENT_OFF_MAX, validate: isIntegerOrNull },
    // USD cents. Set when type is "fixed", else null.
    amountOffCents: {
      type: Number,
      default: null,
      min: AMOUNT_OFF_MIN_CENTS,
      max: AMOUNT_OFF_MAX_CENTS,
      validate: isIntegerOrNull,
    },
    appliesTo: { type: String, required: true, enum: COUPON_APPLIES_TO },
    // The themes of a "selected" coupon. Empty when appliesTo is "all".
    themeIds: { type: [{ type: Schema.Types.ObjectId, ref: "Theme" }], default: [], validate: hasAtMostThemes },
    // Last moment the coupon works. null = never expires.
    expiresAt: { type: Date, default: null },
    // null = unlimited.
    maxRedemptions: { type: Number, default: null, min: 1, validate: isIntegerOrNull },
    // Plus 1 each time an order (card or wallet) is created with this coupon.
    redemptionsCount: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
    active: { type: Boolean, required: true, default: true },
    provider: { type: providerSchema, required: true, default: () => ({}) },
  },
  { collection: "coupons", timestamps: true },
);

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ active: 1, createdAt: -1 });

export type CouponRecord = InferSchemaType<typeof couponSchema> & { _id: Types.ObjectId };

// `models.Coupon ||` stops hot reload from defining the model twice.
export const CouponModel = (models.Coupon as Model<CouponRecord>) || model<CouponRecord>("Coupon", couponSchema);
