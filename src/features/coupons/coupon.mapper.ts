import { formatPrice } from "@/shared/lib/money";
import type { CouponRecord } from "@/features/coupons/coupon.model";
import type { CouponAdminDTO, CouponListItemDTO } from "@/features/coupons/coupon.types";

function toDiscountLabel(coupon: CouponRecord): string {
  if (coupon.type === "percent") return `${coupon.percentOff}%`;
  return formatPrice(coupon.amountOffCents ?? 0, "usd");
}

function toThemesLabel(coupon: CouponRecord): string {
  if (coupon.appliesTo === "all") return "All themes";
  return coupon.themeIds.length === 1 ? "1 theme" : `${coupon.themeIds.length} themes`;
}

export function toCouponListItemDTO(coupon: CouponRecord): CouponListItemDTO {
  return {
    id: coupon._id.toString(),
    code: coupon.code,
    discountLabel: toDiscountLabel(coupon),
    themesLabel: toThemesLabel(coupon),
    redemptionsCount: coupon.redemptionsCount,
    maxRedemptions: coupon.maxRedemptions ?? null,
    expiresAt: coupon.expiresAt ?? null,
    active: coupon.active,
  };
}

export function toCouponAdminDTO(coupon: CouponRecord, themeNames: string[]): CouponAdminDTO {
  return {
    id: coupon._id.toString(),
    code: coupon.code,
    type: coupon.type,
    percentOff: coupon.percentOff ?? null,
    amountOffCents: coupon.amountOffCents ?? null,
    appliesTo: coupon.appliesTo,
    themeIds: coupon.themeIds.map((themeId) => themeId.toString()),
    themeNames,
    expiresAt: coupon.expiresAt ?? null,
    maxRedemptions: coupon.maxRedemptions ?? null,
    redemptionsCount: coupon.redemptionsCount,
    active: coupon.active,
    isSynced: (coupon.provider.discountId ?? null) !== null,
  };
}
