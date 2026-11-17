import { z } from "zod";
import {
  AMOUNT_OFF_MAX_CENTS,
  AMOUNT_OFF_MIN_CENTS,
  COUPON_APPLIES_TO,
  COUPON_CODE_PATTERN,
  COUPON_MESSAGES,
  COUPON_TYPES,
  MAX_COUPON_THEMES,
  PERCENT_OFF_MAX,
  PERCENT_OFF_MIN,
  type CouponAppliesTo,
  type CouponType,
} from "@/features/coupons/coupon.constants";

const CENTS_PER_DOLLAR = 100;
const WHOLE_NUMBER_PATTERN = /^\d{1,9}$/;
const DOLLARS_PATTERN = /^\d{1,6}(\.\d{1,2})?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const END_OF_DAY_SUFFIX = "T23:59:59.999Z";

function isRealDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isDateOrEmpty(value: string): boolean {
  return value === "" || isRealDate(value);
}

function isLimitOrEmpty(value: string): boolean {
  return value === "" || (WHOLE_NUMBER_PATTERN.test(value) && Number(value) >= 1);
}

function isPercent(value: string): boolean {
  if (!WHOLE_NUMBER_PATTERN.test(value)) return false;
  return Number(value) >= PERCENT_OFF_MIN && Number(value) <= PERCENT_OFF_MAX;
}

function toCents(value: string): number {
  return Math.round(Number(value) * CENTS_PER_DOLLAR);
}

function isAmountInDollars(value: string): boolean {
  if (!DOLLARS_PATTERN.test(value)) return false;
  return toCents(value) >= AMOUNT_OFF_MIN_CENTS && toCents(value) <= AMOUNT_OFF_MAX_CENTS;
}

// The fields of the form, as text. Rules that look at two fields together are in `checkTogether`.
const formFields = {
  code: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .refine((value) => COUPON_CODE_PATTERN.test(value), COUPON_MESSAGES.codeFormat),
  type: z.enum(COUPON_TYPES, { error: COUPON_MESSAGES.typeChoice }),
  value: z.string().trim(),
  appliesTo: z.enum(COUPON_APPLIES_TO, { error: COUPON_MESSAGES.appliesToChoice }),
  themeIds: z.array(z.string().trim()),
  expiresAt: z.string().trim().refine(isDateOrEmpty, COUPON_MESSAGES.dateInvalid),
  maxRedemptions: z.string().trim().refine(isLimitOrEmpty, COUPON_MESSAGES.limitInvalid),
};

type FormValues = {
  type: CouponType;
  value: string;
  appliesTo: CouponAppliesTo;
  themeIds: string[];
};

function uniqueThemeIds(themeIds: string[]): string[] {
  return [...new Set(themeIds)];
}

function checkTogether(data: FormValues, context: z.RefinementCtx): void {
  const isValueValid = data.type === "percent" ? isPercent(data.value) : isAmountInDollars(data.value);
  if (!isValueValid) {
    const message = data.type === "percent" ? COUPON_MESSAGES.percentRange : COUPON_MESSAGES.amountRange;
    context.addIssue({ code: "custom", message, path: ["value"] });
  }
  if (data.appliesTo !== "selected") return;
  const themeCount = uniqueThemeIds(data.themeIds).length;
  if (themeCount === 0) {
    context.addIssue({ code: "custom", message: COUPON_MESSAGES.themesRequired, path: ["themeIds"] });
  }
  if (themeCount > MAX_COUPON_THEMES) {
    context.addIssue({ code: "custom", message: COUPON_MESSAGES.themesTooMany, path: ["themeIds"] });
  }
}

type ParsedForm = FormValues & { code: string; expiresAt: string; maxRedemptions: string };

function toCouponFields(data: ParsedForm) {
  const isPercentCoupon = data.type === "percent";
  return {
    code: data.code,
    type: data.type,
    percentOff: isPercentCoupon ? Number(data.value) : null,
    amountOffCents: isPercentCoupon ? null : toCents(data.value),
    appliesTo: data.appliesTo,
    themeIds: data.appliesTo === "selected" ? uniqueThemeIds(data.themeIds) : [],
    expiresAt: data.expiresAt === "" ? null : new Date(data.expiresAt + END_OF_DAY_SUFFIX),
    maxRedemptions: data.maxRedemptions === "" ? null : Number(data.maxRedemptions),
  };
}

// The form sends the value as text. The result has `percentOff` and `amountOffCents` instead of `value`.
export const couponInputSchema = z.object(formFields).superRefine(checkTogether).transform(toCouponFields);

export type CouponInput = z.output<typeof couponInputSchema>;

// Editing: every field can change (D-018), plus `active`.
export const couponUpdateSchema = z
  .object({ ...formFields, active: z.boolean() })
  .superRefine(checkTogether)
  .transform((data) => ({ ...toCouponFields(data), active: data.active }));

export type CouponUpdateInput = z.output<typeof couponUpdateSchema>;
