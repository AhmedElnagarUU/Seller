import type { ClientSession } from "mongoose";
import { usdCentsToEgpPounds } from "@/shared/lib/money";
import { recordRedemption } from "@/features/coupons/coupon.service";
import * as orderRepository from "@/features/orders/order.repository";
import { grantFromOrder } from "@/features/ownerships/ownership.service";
import { adjustSalesCount } from "@/features/themes/theme.service";

const PIASTERS_PER_POUND = 100;

export type WalletOrderInput = {
  walletPaymentId: string;
  userId: string;
  themeId: string;
  themeName: string;
  themeSlug: string;
  amountEgp: number;
  usdPriceCents: number;
  exchangeRate: number;
  couponId: string | null;
  couponCode: string | null;
  paidAt: Date;
};

// Saves the order of an approved wallet payment and everything that follows from it (docs/03-data-model.md
// section 19). Runs inside the transaction of the admin approval. The caller writes the activity entry.
export async function recordWalletOrder(input: WalletOrderInput, session: ClientSession): Promise<{ orderId: string }> {
  const totalAmount = input.amountEgp * PIASTERS_PER_POUND;
  const subtotalAmount = usdCentsToEgpPounds(input.usdPriceCents, input.exchangeRate) * PIASTERS_PER_POUND;
  const created = await orderRepository.insertOrder(
    {
      userId: input.userId,
      themeId: input.themeId,
      themeSnapshot: { name: input.themeName, slug: input.themeSlug },
      method: "wallet",
      status: "paid",
      currency: "egp",
      subtotalAmount,
      discountAmount: Math.max(0, subtotalAmount - totalAmount),
      taxAmount: 0,
      totalAmount,
      refundedAmount: 0,
      couponId: input.couponId,
      couponCode: input.couponCode,
      walletPaymentId: input.walletPaymentId,
      provider: { name: "manual_wallet", orderId: input.walletPaymentId, checkoutId: null, customerId: null },
      paidAt: input.paidAt,
      refundedAt: null,
    },
    session,
  );
  const orderId = created._id.toString();
  await grantFromOrder({ userId: input.userId, themeId: input.themeId, orderId }, session);
  await adjustSalesCount(input.themeId, 1, session);
  if (input.couponId) await recordRedemption(input.couponId, session);
  return { orderId };
}
