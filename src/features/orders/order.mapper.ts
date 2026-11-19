import type { OrderRecord } from "@/features/orders/order.model";
import type { OrderEmailDTO, OrderListItemDTO, OrderSuccessDTO } from "@/features/orders/order.types";

export function toOrderListItemDTO(order: OrderRecord): OrderListItemDTO {
  return {
    id: order._id.toString(),
    paidAt: order.paidAt,
    themeName: order.themeSnapshot.name,
    themeSlug: order.themeSnapshot.slug,
    method: order.method,
    status: order.status,
    totalAmount: order.totalAmount,
    currency: order.currency,
  };
}

export function toOrderSuccessDTO(order: OrderRecord): OrderSuccessDTO {
  return {
    id: order._id.toString(),
    themeId: order.themeId.toString(),
    themeName: order.themeSnapshot.name,
    themeSlug: order.themeSnapshot.slug,
  };
}

export function toOrderEmailDTO(order: OrderRecord): OrderEmailDTO {
  return {
    id: order._id.toString(),
    userId: order.userId.toString(),
    themeName: order.themeSnapshot.name,
    paidAt: order.paidAt,
    totalAmount: order.totalAmount,
    discountAmount: order.discountAmount,
    currency: order.currency,
    couponCode: order.couponCode ?? null,
  };
}
