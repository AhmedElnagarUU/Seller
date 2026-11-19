import type { ClientSession } from "mongoose";
import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import { formatPrice } from "@/shared/lib/money";
import * as activityService from "@/features/activity/activity.service";
import { getCouponSummary, recordRedemption } from "@/features/coupons/coupon.service";
import { ORDER_EVENT_MESSAGES, ORDERS_PER_PAGE } from "@/features/orders/order.constants";
import { toOrderEmailDTO, toOrderListItemDTO, toOrderSuccessDTO } from "@/features/orders/order.mapper";
import type { OrderRecord } from "@/features/orders/order.model";
import * as orderRepository from "@/features/orders/order.repository";
import type {
  OrderEmailDTO,
  OrderPageDTO,
  OrderSuccessDTO,
  RecordCardOrderResult,
  RecordRefundResult,
} from "@/features/orders/order.types";
import { grantFromOrder, revokeForRefund } from "@/features/ownerships/ownership.service";
import type { NormalizedOrder, ProviderName } from "@/features/payments/payment.types";
import { adjustSalesCount, getThemeForPurchaseById } from "@/features/themes/theme.service";
import type { ThemePurchaseDTO } from "@/features/themes/theme.types";
import { getUserSummary } from "@/features/users/user.service";

type RefundInput = {
  providerName: ProviderName;
  providerOrderId: string;
  refundedAmount: number;
  isFullRefund: boolean;
};

// The permanent checks of a paid event. Each failure is an AppError with the message for the admin.
async function assertPaidEventIsValid(order: NormalizedOrder): Promise<ThemePurchaseDTO> {
  if ((await getUserSummary(order.userId)) === null) throw new AppError("INVALID", ORDER_EVENT_MESSAGES.invalidUser);
  const theme = await getThemeForPurchaseById(order.themeId);
  if (theme === null) throw new AppError("INVALID", ORDER_EVENT_MESSAGES.invalidTheme);
  if (order.currency !== "usd") throw new AppError("INVALID", ORDER_EVENT_MESSAGES.wrongCurrency);
  return theme;
}

// The coupon of the event, or null: a coupon that was deleted meanwhile must not lose a paid order (D-018).
async function findCoupon(couponId: string | null): Promise<{ id: string; code: string } | null> {
  if (couponId === null) return null;
  return getCouponSummary(couponId);
}

// Saves the order of a paid card event and everything that follows from it (docs/03-data-model.md section 19).
// Runs inside the transaction of processPaymentEvent.
export async function recordCardOrder(
  order: NormalizedOrder,
  providerName: ProviderName,
  session: ClientSession,
): Promise<RecordCardOrderResult> {
  const theme = await assertPaidEventIsValid(order);
  const existing = await orderRepository.findOrderByProvider(providerName, order.providerOrderId, session);
  if (existing) return { outcome: "already_recorded" };
  const coupon = await findCoupon(order.couponId);
  const created = await orderRepository.insertOrder(
    {
      userId: order.userId,
      themeId: order.themeId,
      themeSnapshot: { name: theme.name, slug: theme.slug },
      method: "card",
      status: "paid",
      currency: "usd",
      subtotalAmount: order.subtotalAmount,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      refundedAmount: 0,
      couponId: coupon?.id ?? null,
      couponCode: coupon?.code ?? null,
      walletPaymentId: null,
      provider: {
        name: providerName,
        orderId: order.providerOrderId,
        checkoutId: order.checkoutId,
        customerId: order.providerCustomerId,
      },
      paidAt: order.paidAt,
      refundedAt: null,
    },
    session,
  );
  const orderId = created._id.toString();
  await grantFromOrder({ userId: order.userId, themeId: order.themeId, orderId }, session);
  await adjustSalesCount(order.themeId, 1, session);
  if (coupon) await recordRedemption(coupon.id, session);
  await activityService.log(
    {
      action: "order_paid",
      actorRole: "system",
      subjectUserId: order.userId,
      targetType: "order",
      targetId: orderId,
      summary: `Order paid: ${theme.name} (${formatPrice(order.totalAmount, "usd")})`,
    },
    session,
  );
  return { outcome: "created", orderId };
}

// A full refund: the order is final, the ownership of this order is revoked and the sale is taken back.
export async function applyFullRefund(
  order: OrderRecord,
  refundedAmount: number,
  session: ClientSession,
): Promise<void> {
  const orderId = order._id.toString();
  const userId = order.userId.toString();
  const themeId = order.themeId.toString();
  await orderRepository.updateOrderRefund(orderId, { status: "refunded", refundedAmount, refundedAt: now() }, session);
  await revokeForRefund({ userId, themeId, orderId }, session);
  await adjustSalesCount(themeId, -1, session);
  await activityService.log(
    {
      action: "order_refunded",
      actorRole: "system",
      subjectUserId: userId,
      targetType: "order",
      targetId: orderId,
      summary: `Order refunded: ${order.themeSnapshot.name} (${formatPrice(order.totalAmount, order.currency)})`,
    },
    session,
  );
}

// A refund event of the payment provider. "refunded" is final: later events change nothing.
export async function recordRefund(input: RefundInput, session: ClientSession): Promise<RecordRefundResult> {
  const order = await orderRepository.findOrderByProvider(input.providerName, input.providerOrderId, session);
  if (!order) return { outcome: "order_not_found" };
  if (order.status === "refunded") return { outcome: "unchanged" };
  if (input.isFullRefund) {
    await applyFullRefund(order, input.refundedAmount, session);
    return { outcome: "refunded" };
  }
  const fields = { status: "partially_refunded", refundedAmount: input.refundedAmount, refundedAt: null } as const;
  await orderRepository.updateOrderRefund(order._id.toString(), fields, session);
  return { outcome: "partially_refunded" };
}

// One page of the orders of a customer, newest first. Page numbers below 1 count as 1.
export async function listOrdersForUser(userId: string, page: number): Promise<OrderPageDTO> {
  const pageNumber = Math.max(1, page);
  const [orders, total] = await Promise.all([
    orderRepository.findOrdersForUser(userId, pageNumber, ORDERS_PER_PAGE),
    orderRepository.countOrdersForUser(userId),
  ]);
  return {
    items: orders.map(toOrderListItemDTO),
    page: pageNumber,
    totalPages: Math.ceil(total / ORDERS_PER_PAGE),
    total,
  };
}

// The order of a checkout for the success page. Another customer's order gives null.
export async function getOrderForCheckout(userId: string, checkoutId: string): Promise<OrderSuccessDTO | null> {
  const order = await orderRepository.findOrderByCheckoutId(userId, checkoutId);
  return order ? toOrderSuccessDTO(order) : null;
}

// The order for the confirmation email, or null for an unknown or invalid id.
export async function getOrderForEmail(orderId: string): Promise<OrderEmailDTO | null> {
  const order = await orderRepository.findOrderById(orderId);
  return order ? toOrderEmailDTO(order) : null;
}

// The total of the order of a provider, or null when it does not exist. Used by the fake refund helper.
export async function getRefundBase(providerName: ProviderName, providerOrderId: string): Promise<number | null> {
  const order = await orderRepository.findOrderByProvider(providerName, providerOrderId);
  return order ? order.totalAmount : null;
}
