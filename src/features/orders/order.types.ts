import type { OrderCurrency, OrderMethod, OrderStatus } from "@/features/orders/order.constants";

export type OrderListItemDTO = {
  id: string;
  paidAt: Date;
  themeName: string;
  themeSlug: string;
  method: OrderMethod;
  status: OrderStatus;
  totalAmount: number;
  currency: OrderCurrency;
};

export type OrderPageDTO = {
  items: OrderListItemDTO[];
  page: number;
  totalPages: number;
  total: number;
};

// What the success page needs.
export type OrderSuccessDTO = {
  id: string;
  themeId: string;
  themeName: string;
  themeSlug: string;
};

// What the order confirmation email needs.
export type OrderEmailDTO = {
  id: string;
  userId: string;
  themeName: string;
  paidAt: Date;
  totalAmount: number;
  discountAmount: number;
  currency: OrderCurrency;
  couponCode: string | null;
};

export type RecordCardOrderResult = { outcome: "created"; orderId: string } | { outcome: "already_recorded" };

export type RecordRefundResult = {
  outcome: "order_not_found" | "unchanged" | "partially_refunded" | "refunded";
};
