import type { CouponAppliesTo, CouponType } from "@/features/coupons/coupon.constants";

// The result of the price check. `code` is the stored (uppercase) code.
export type CouponQuote = {
  couponId: string;
  code: string;
  discountCents: number;
  finalCents: number;
};

export type CouponListItemDTO = {
  id: string;
  code: string;
  discountLabel: string;
  themesLabel: string;
  redemptionsCount: number;
  maxRedemptions: number | null;
  expiresAt: Date | null;
  active: boolean;
};

export type CouponAdminDTO = {
  id: string;
  code: string;
  type: CouponType;
  percentOff: number | null;
  amountOffCents: number | null;
  appliesTo: CouponAppliesTo;
  themeIds: string[];
  themeNames: string[];
  expiresAt: Date | null;
  maxRedemptions: number | null;
  redemptionsCount: number;
  active: boolean;
  isSynced: boolean;
};
