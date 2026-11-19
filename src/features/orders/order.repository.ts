import type { ClientSession } from "mongoose";
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
