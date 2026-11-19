import type { ClientSession, QueryFilter, Types } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { parseObjectId, toObjectId } from "@/shared/db/ids";
import type { OrderCurrency, OrderMethod, OrderProviderName, OrderStatus } from "@/features/orders/order.constants";
import { OrderModel, type OrderRecord } from "@/features/orders/order.model";

// The fields of a new order. Ids are text; the repository turns them into ObjectIds.
export type NewOrderFields = {
  userId: string;
  themeId: string;
  themeSnapshot: { name: string; slug: string };
  method: OrderMethod;
  status: OrderStatus;
  currency: OrderCurrency;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  refundedAmount: number;
  couponId: string | null;
  couponCode: string | null;
  walletPaymentId: string | null;
  provider: { name: OrderProviderName; orderId: string; checkoutId: string | null; customerId: string | null };
  paidAt: Date;
  refundedAt: Date | null;
};

export type RefundFields = { status: OrderStatus; refundedAmount: number; refundedAt: Date | null };

function toOptionalObjectId(id: string | null) {
  return id ? toObjectId(id) : null;
}

// Inserts an order. With a session the write is part of that transaction.
export async function insertOrder(fields: NewOrderFields, session: ClientSession): Promise<OrderRecord> {
  await connectDB();
  const [created] = await OrderModel.create(
    [
      {
        ...fields,
        userId: toObjectId(fields.userId),
        themeId: toObjectId(fields.themeId),
        couponId: toOptionalObjectId(fields.couponId),
        walletPaymentId: toOptionalObjectId(fields.walletPaymentId),
      },
    ],
    { session },
  );
  if (!created) throw new Error("The order was not created.");
  return created.toObject();
}

// Finds the order of a provider by the provider's own order id, or null.
export async function findOrderByProvider(
  providerName: OrderProviderName,
  providerOrderId: string,
  session?: ClientSession,
): Promise<OrderRecord | null> {
  await connectDB();
  return OrderModel.findOne({ "provider.name": providerName, "provider.orderId": providerOrderId }, null, {
    session,
  }).lean<OrderRecord>();
}

// Finds an order by id, or null (also when the id is not a valid id).
export async function findOrderById(id: string): Promise<OrderRecord | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  await connectDB();
  return OrderModel.findById(objectId).lean<OrderRecord>();
}

// Finds the order of a user by the provider's checkout id, or null. Another user's order is never found.
export async function findOrderByCheckoutId(userId: string, checkoutId: string): Promise<OrderRecord | null> {
  const userObjectId = parseObjectId(userId);
  if (!userObjectId) return null;
  await connectDB();
  return OrderModel.findOne({ userId: userObjectId, "provider.checkoutId": checkoutId }).lean<OrderRecord>();
}

// Saves the refund data of an order.
export async function updateOrderRefund(id: string, fields: RefundFields, session: ClientSession): Promise<void> {
  await connectDB();
  await OrderModel.updateOne({ _id: toObjectId(id) }, { $set: fields }, { session });
}

// One page of the orders of a user, newest first. Pages are numbered from 1.
export async function findOrdersForUser(userId: string, page: number, pageSize: number): Promise<OrderRecord[]> {
  const userObjectId = parseObjectId(userId);
  if (!userObjectId) return [];
  await connectDB();
  return OrderModel.find({ userId: userObjectId })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean<OrderRecord[]>();
}

// Counts the orders of a user.
export async function countOrdersForUser(userId: string): Promise<number> {
  const userObjectId = parseObjectId(userId);
  if (!userObjectId) return 0;
  await connectDB();
  return OrderModel.countDocuments({ userId: userObjectId });
}

export type AdminOrderFilter = {
  method?: OrderMethod;
  status?: OrderStatus;
  paidFrom?: Date;
  paidBefore?: Date;
};

function buildAdminOrderQuery(filter: AdminOrderFilter): QueryFilter<OrderRecord> {
  const query: QueryFilter<OrderRecord> = {};
  if (filter.method) query.method = filter.method;
  if (filter.status) query.status = filter.status;
  const paidAt: { $gte?: Date; $lt?: Date } = {};
  if (filter.paidFrom) paidAt.$gte = filter.paidFrom;
  if (filter.paidBefore) paidAt.$lt = filter.paidBefore;
  if (paidAt.$gte || paidAt.$lt) query.paidAt = paidAt;
  return query;
}

// One page of all orders for the admin, newest paid first. Pages are numbered from 1.
export async function findOrdersForAdmin(
  filter: AdminOrderFilter,
  page: number,
  pageSize: number,
): Promise<OrderRecord[]> {
  await connectDB();
  return OrderModel.find(buildAdminOrderQuery(filter))
    .sort({ paidAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean<OrderRecord[]>();
}

// Counts the orders that match the admin filter.
export async function countOrdersForAdmin(filter: AdminOrderFilter): Promise<number> {
  await connectDB();
  return OrderModel.countDocuments(buildAdminOrderQuery(filter));
}

// Finds any order by id for the admin, or null (also when the id is not a valid id).
export async function findOrderByIdForAdmin(id: string): Promise<OrderRecord | null> {
  return findOrderById(id);
}

// Marks a paid wallet order as fully refunded. Returns the updated order, or null when the order is not a
// paid wallet order (wrong method, wrong status or not found). The pipeline copies the order's own total.
export async function markWalletOrderRefundedIfPaid(
  id: string,
  refundedAt: Date,
  session: ClientSession,
): Promise<OrderRecord | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  await connectDB();
  return OrderModel.findOneAndUpdate(
    { _id: objectId, method: "wallet", status: "paid" },
    [{ $set: { status: "refunded", refundedAmount: "$totalAmount", refundedAt } }],
    { returnDocument: "after", updatePipeline: true, session },
  ).lean<OrderRecord | null>();
}

const COUNTED_STATUSES: OrderStatus[] = ["paid", "partially_refunded"];

// The orders that count as sales: paid and partly refunded, optionally from a moment on (inclusive).
function buildSalesMatch(since: Date | null): QueryFilter<OrderRecord> {
  return since ? { status: { $in: COUNTED_STATUSES }, paidAt: { $gte: since } } : { status: { $in: COUNTED_STATUSES } };
}

// Orders and revenue (total minus refunds) of one currency, from a moment on or for all time.
export async function sumSales(
  currency: OrderCurrency,
  since: Date | null,
): Promise<{ orders: number; revenueAmount: number }> {
  await connectDB();
  const rows = await OrderModel.aggregate<{ orders: number; revenueAmount: number }>([
    { $match: { currency, ...buildSalesMatch(since) } },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        revenueAmount: { $sum: { $subtract: ["$totalAmount", "$refundedAmount"] } },
      },
    },
  ]);
  const row = rows[0];
  return row ? { orders: row.orders, revenueAmount: row.revenueAmount } : { orders: 0, revenueAmount: 0 };
}

// The themes with the most sales, most first; equal counts by theme id.
export async function topThemesBySales(
  since: Date | null,
  limit: number,
): Promise<{ themeId: string; count: number }[]> {
  await connectDB();
  const rows = await OrderModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: buildSalesMatch(since) },
    { $group: { _id: "$themeId", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
  ]);
  return rows.map((row) => ({ themeId: row._id.toString(), count: row.count }));
}
