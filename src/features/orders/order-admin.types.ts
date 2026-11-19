import type { OrderCurrency, OrderMethod, OrderProviderName, OrderStatus } from "@/features/orders/order.constants";

export type AdminOrderListItemDTO = {
  id: string;
  paidAt: Date;
  customerId: string;
  customerName: string;
  customerEmail: string;
  themeName: string;
  method: OrderMethod;
  currency: OrderCurrency;
  totalAmount: number;
  status: OrderStatus;
};

export type AdminOrderPageDTO = {
  items: AdminOrderListItemDTO[];
  page: number;
  totalPages: number;
  total: number;
};

export type AdminOrderDTO = {
  id: string;
  status: OrderStatus;
  method: OrderMethod;
  currency: OrderCurrency;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  refundedAmount: number;
  couponCode: string | null;
  customer: { id: string; name: string; email: string };
  // Name and slug are the copies saved on the order (themeSnapshot).
  theme: { id: string; name: string; slug: string };
  provider: { name: OrderProviderName; orderId: string; checkoutId: string | null; customerId: string | null };
  walletPaymentId: string | null;
  paidAt: Date;
  refundedAt: Date | null;
  // True only for a wallet order that is still "paid".
  canMarkRefunded: boolean;
};
