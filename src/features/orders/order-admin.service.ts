import { AppError } from "@/shared/errors";
import { withTransaction } from "@/shared/db/transaction";
import { now } from "@/shared/lib/clock";
import { formatPrice } from "@/shared/lib/money";
import * as activityService from "@/features/activity/activity.service";
import { ORDERS_PER_PAGE, type OrderMethod, type OrderStatus } from "@/features/orders/order.constants";
import type { OrderRecord } from "@/features/orders/order.model";
import * as orderRepository from "@/features/orders/order.repository";
import type { AdminOrderDTO, AdminOrderListItemDTO, AdminOrderPageDTO } from "@/features/orders/order-admin.types";
import { revokeForRefund } from "@/features/ownerships/ownership.service";
import { adjustSalesCount } from "@/features/themes/theme.service";
import { getUserSummaries } from "@/features/users/user.service";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MISSING_USER_TEXT = "—";

const ORDER_ADMIN_MESSAGES = {
  notFound: "Order not found.",
  cannotRefund: "This order cannot be marked as refunded.",
} as const;

type ListOrdersInput = {
  method?: OrderMethod;
  status?: OrderStatus;
  from?: string;
  to?: string;
  page: number;
};

type Customer = { id: string; name: string; email: string };

function startOfDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

// The order of a customer that no longer exists shows a dash.
function customerOf(order: OrderRecord, customers: Map<string, Customer>): Customer {
  const userId = order.userId.toString();
  return customers.get(userId) ?? { id: userId, name: MISSING_USER_TEXT, email: MISSING_USER_TEXT };
}

async function loadCustomers(orders: OrderRecord[]): Promise<Map<string, Customer>> {
  const userIds = [...new Set(orders.map((order) => order.userId.toString()))];
  const users = await getUserSummaries(userIds);
  return new Map(users.map((user) => [user.id, { id: user.id, name: user.name, email: user.email }]));
}

function toListItem(order: OrderRecord, customers: Map<string, Customer>): AdminOrderListItemDTO {
  const customer = customerOf(order, customers);
  return {
    id: order._id.toString(),
    paidAt: order.paidAt,
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
    themeName: order.themeSnapshot.name,
    method: order.method,
    currency: order.currency,
    totalAmount: order.totalAmount,
    status: order.status,
  };
}

// One page of all orders, newest paid first. `from` and `to` are UTC days and both are included.
export async function listOrdersForAdmin(input: ListOrdersInput): Promise<AdminOrderPageDTO> {
  const page = Math.max(1, input.page);
  const filter = {
    method: input.method,
    status: input.status,
    paidFrom: input.from ? startOfDay(input.from) : undefined,
    paidBefore: input.to ? new Date(startOfDay(input.to).getTime() + MILLISECONDS_PER_DAY) : undefined,
  };
  const [orders, total] = await Promise.all([
    orderRepository.findOrdersForAdmin(filter, page, ORDERS_PER_PAGE),
    orderRepository.countOrdersForAdmin(filter),
  ]);
  const customers = await loadCustomers(orders);
  return {
    items: orders.map((order) => toListItem(order, customers)),
    page,
    totalPages: Math.ceil(total / ORDERS_PER_PAGE),
    total,
  };
}

// Everything the admin order page shows, or null for an unknown or invalid id.
export async function getOrderForAdmin(id: string): Promise<AdminOrderDTO | null> {
  const order = await orderRepository.findOrderByIdForAdmin(id);
  if (!order) return null;
  const customers = await loadCustomers([order]);
  return {
    id: order._id.toString(),
    status: order.status,
    method: order.method,
    currency: order.currency,
    subtotalAmount: order.subtotalAmount,
    discountAmount: order.discountAmount,
    taxAmount: order.taxAmount,
    totalAmount: order.totalAmount,
    refundedAmount: order.refundedAmount,
    couponCode: order.couponCode ?? null,
    customer: customerOf(order, customers),
    theme: { id: order.themeId.toString(), name: order.themeSnapshot.name, slug: order.themeSnapshot.slug },
    provider: {
      name: order.provider.name,
      orderId: order.provider.orderId,
      checkoutId: order.provider.checkoutId ?? null,
      customerId: order.provider.customerId ?? null,
    },
    walletPaymentId: order.walletPaymentId?.toString() ?? null,
    paidAt: order.paidAt,
    refundedAt: order.refundedAt ?? null,
    canMarkRefunded: order.method === "wallet" && order.status === "paid",
  };
}

// The admin marks a paid wallet order as refunded (the money went back outside the site, D-105). One transaction:
// the order, the ownership of this order, the sales counter and the log.
export async function markWalletOrderRefunded(orderId: string, adminUserId: string): Promise<void> {
  const existing = await orderRepository.findOrderByIdForAdmin(orderId);
  if (!existing) throw new AppError("NOT_FOUND", ORDER_ADMIN_MESSAGES.notFound);
  await withTransaction(async (session) => {
    const order = await orderRepository.markWalletOrderRefundedIfPaid(orderId, now(), session);
    if (!order) throw new AppError("INVALID", ORDER_ADMIN_MESSAGES.cannotRefund);
    const userId = order.userId.toString();
    const themeId = order.themeId.toString();
    await revokeForRefund({ userId, themeId, orderId }, session);
    await adjustSalesCount(themeId, -1, session);
    await activityService.log(
      {
        action: "order_refunded",
        actorRole: "admin",
        actorUserId: adminUserId,
        subjectUserId: userId,
        targetType: "order",
        targetId: orderId,
        summary: `Order refunded: ${order.themeSnapshot.name} (${formatPrice(order.totalAmount, order.currency)})`,
      },
      session,
    );
  });
}
