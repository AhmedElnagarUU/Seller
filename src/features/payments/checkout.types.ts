import type { CouponQuote } from "@/features/coupons/coupon.types";

// The theme fields that the checkout page shows.
export type CheckoutThemeDTO = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  priceCents: number;
};

// What the wallet option of the checkout page shows.
export type CheckoutWalletDTO = { amountEgp: number; exchangeRate: number };

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
      // The wallet option. null when the customer cannot pay by wallet.
      wallet: CheckoutWalletDTO | null;
    };

// What the fake checkout page shows.
export type FakeCheckoutDTO = {
  themeName: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  couponCode: string | null;
};
