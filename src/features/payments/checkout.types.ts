import type { CouponQuote } from "@/features/coupons/coupon.types";

// The theme fields that the checkout page shows.
export type CheckoutThemeDTO = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  priceCents: number;
};

export type CheckoutPageData =
  | { kind: "not_found" }
  | { kind: "owned" }
  | {
      kind: "ready";
      theme: CheckoutThemeDTO;
      couponCode: string | null;
      quote: CouponQuote | null;
      couponError: string | null;
      finalPriceCents: number;
    };

// What the fake checkout page shows.
export type FakeCheckoutDTO = {
  themeName: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  couponCode: string | null;
};
