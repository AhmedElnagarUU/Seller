import type { ClientSession } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { parseObjectId, toObjectId } from "@/shared/db/ids";
import type { ImageContentType } from "@/shared/storage/keys";
import type { WalletPaymentStatus } from "@/features/wallet-payments/wallet-payment.constants";
import { WalletPaymentModel, type WalletPaymentRecord } from "@/features/wallet-payments/wallet-payment.model";

// The fields of a new request. Ids are text; the repository turns them into ObjectIds.
export type NewWalletPaymentFields = {
  userId: string;
  themeId: string;
  themeSnapshot: { name: string; slug: string };
  referenceCode: string;
  usdPriceCents: number;
  usdDiscountCents: number;
  couponId: string | null;
  couponCode: string | null;
  exchangeRate: number;
  amountEgp: number;
};

export type SubmittedFields = {
  senderPhone: string;
  transactionId: string | null;
  proof: { key: string; contentType: ImageContentType; sizeBytes: number };
  submittedAt: Date;
};

export type ReviewFields = {
  status: "approved" | "rejected";
  reviewedAt: Date;
  reviewedByUserId: string;
  rejectionReason: string | null;
};

// Inserts a new request: waiting for payment and open. A unique index can refuse it (duplicate key error).
export async function insertWalletPayment(fields: NewWalletPaymentFields): Promise<WalletPaymentRecord> {
  await connectDB();
  const created = await WalletPaymentModel.create({
    ...fields,
    userId: toObjectId(fields.userId),
    themeId: toObjectId(fields.themeId),
    couponId: fields.couponId ? toObjectId(fields.couponId) : null,
    status: "awaiting_payment",
    isOpen: true,
    senderPhone: null,
    transactionId: null,
    proof: { key: null, contentType: null, sizeBytes: null },
    submittedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    rejectionReason: null,
    orderId: null,
  });
  return created.toObject();
}

// Finds a request by id, or null (also when the id is not a valid id).
export async function findWalletPaymentById(id: string, session?: ClientSession): Promise<WalletPaymentRecord | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  await connectDB();
  return WalletPaymentModel.findById(objectId, null, { session }).lean<WalletPaymentRecord>();
}

// Finds a request of this user, or null. Another user's request is never found.
export async function findWalletPaymentForUser(userId: string, id: string): Promise<WalletPaymentRecord | null> {
  const objectId = parseObjectId(id);
  const userObjectId = parseObjectId(userId);
  if (!objectId || !userObjectId) return null;
  await connectDB();
  return WalletPaymentModel.findOne({ _id: objectId, userId: userObjectId }).lean<WalletPaymentRecord>();
}

// The open request of this user for this theme, or null.
export async function findOpenWalletPayment(userId: string, themeId: string): Promise<WalletPaymentRecord | null> {
  await connectDB();
  return WalletPaymentModel.findOne({
    userId: toObjectId(userId),
    themeId: toObjectId(themeId),
    isOpen: true,
  }).lean<WalletPaymentRecord>();
}

// All requests of a user, newest first.
export async function findWalletPaymentsForUser(userId: string): Promise<WalletPaymentRecord[]> {
  const userObjectId = parseObjectId(userId);
  if (!userObjectId) return [];
  await connectDB();
  return WalletPaymentModel.find({ userId: userObjectId })
    .sort({ createdAt: -1, _id: -1 })
    .lean<WalletPaymentRecord[]>();
}

// Cancels a request that is still waiting for payment. Returns true when it changed.
export async function cancelAwaitingWalletPayment(userId: string, id: string): Promise<boolean> {
  await connectDB();
  const result = await WalletPaymentModel.updateOne(
    { _id: toObjectId(id), userId: toObjectId(userId), status: "awaiting_payment" },
    { $set: { status: "cancelled", isOpen: false } },
  );
  return result.modifiedCount === 1;
}

// Moves a request that is waiting for payment to "submitted". Returns true when it changed.
export async function submitAwaitingWalletPayment(
  userId: string,
  id: string,
  fields: SubmittedFields,
): Promise<boolean> {
  await connectDB();
  const result = await WalletPaymentModel.updateOne(
    { _id: toObjectId(id), userId: toObjectId(userId), status: "awaiting_payment" },
    { $set: { status: "submitted", ...fields } },
  );
  return result.modifiedCount === 1;
}

// The review of the admin. Only a "submitted" request changes. Returns true when it changed.
export async function reviewSubmittedWalletPayment(
  id: string,
  fields: ReviewFields,
  session: ClientSession,
): Promise<boolean> {
  await connectDB();
  const result = await WalletPaymentModel.updateOne(
    { _id: toObjectId(id), status: "submitted" },
    { $set: { ...fields, isOpen: false, reviewedByUserId: toObjectId(fields.reviewedByUserId) } },
    { session },
  );
  return result.modifiedCount === 1;
}

// Saves the order of an approved request.
export async function setWalletPaymentOrderId(id: string, orderId: string, session: ClientSession): Promise<void> {
  await connectDB();
  await WalletPaymentModel.updateOne({ _id: toObjectId(id) }, { $set: { orderId: toObjectId(orderId) } }, { session });
}

// One page of the requests with this status. The review queue shows the oldest submission first.
export async function findWalletPaymentsByStatus(
  status: WalletPaymentStatus,
  page: number,
  pageSize: number,
): Promise<WalletPaymentRecord[]> {
  await connectDB();
  const sort: Record<string, 1 | -1> = status === "submitted" ? { submittedAt: 1, _id: 1 } : { createdAt: -1, _id: -1 };
  return WalletPaymentModel.find({ status })
    .sort(sort)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean<WalletPaymentRecord[]>();
}

// Counts the requests with this status.
export async function countWalletPaymentsByStatus(status: WalletPaymentStatus): Promise<number> {
  await connectDB();
  return WalletPaymentModel.countDocuments({ status });
}
