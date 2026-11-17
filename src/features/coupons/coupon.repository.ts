import type { ClientSession } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { parseObjectId, toObjectId } from "@/shared/db/ids";
import type { CouponAppliesTo, CouponType } from "@/features/coupons/coupon.constants";
import { CouponModel, type CouponRecord } from "@/features/coupons/coupon.model";

// The fields an admin can write. `redemptionsCount` and `provider` are never part of it.
export type CouponFields = {
  code: string;
  type: CouponType;
  percentOff: number | null;
  amountOffCents: number | null;
  appliesTo: CouponAppliesTo;
  themeIds: string[];
  expiresAt: Date | null;
  maxRedemptions: number | null;
};

export type CouponUpdateFields = CouponFields & { active: boolean };

function toDocumentFields(fields: CouponFields) {
  return { ...fields, themeIds: fields.themeIds.map(toObjectId) };
}

// Inserts a coupon (active, never used, not synced yet) and returns it.
export async function insertCoupon(fields: CouponFields, session?: ClientSession): Promise<CouponRecord> {
  await connectDB();
  const created = new CouponModel({
    ...toDocumentFields(fields),
    redemptionsCount: 0,
    active: true,
    provider: { discountId: null, syncedAt: null },
  });
  await created.save({ session });
  return created.toObject();
}

// Finds a coupon by id, or null (also when the id is not a valid id).
export async function findCouponById(id: string): Promise<CouponRecord | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  await connectDB();
  return CouponModel.findById(objectId).lean<CouponRecord>();
}

// Finds a coupon by its stored (uppercase) code, or null.
export async function findCouponByCode(code: string): Promise<CouponRecord | null> {
  await connectDB();
  return CouponModel.findOne({ code }).lean<CouponRecord>();
}

// Lists all coupons, newest first.
export async function listCoupons(): Promise<CouponRecord[]> {
  await connectDB();
  return CouponModel.find().sort({ createdAt: -1, _id: -1 }).lean<CouponRecord[]>();
}

// Replaces the editable fields of a coupon. Returns null when it does not exist.
export async function updateCouponFields(
  id: string,
  fields: CouponUpdateFields,
  session?: ClientSession,
): Promise<CouponRecord | null> {
  await connectDB();
  return CouponModel.findByIdAndUpdate(
    toObjectId(id),
    { $set: { ...toDocumentFields(fields), active: fields.active } },
    { returnDocument: "after", runValidators: true, session },
  ).lean<CouponRecord>();
}

// Deletes a coupon. Returns true when a row was deleted.
export async function deleteCouponById(id: string, session?: ClientSession): Promise<boolean> {
  await connectDB();
  const result = await CouponModel.deleteOne({ _id: toObjectId(id) }, { session });
  return result.deletedCount === 1;
}

// Saves the link to the payment provider's discount. Only `provider.discountId` and `provider.syncedAt` change.
export async function setCouponProvider(
  id: string,
  provider: { discountId: string | null; syncedAt: Date | null },
  session?: ClientSession,
): Promise<void> {
  await connectDB();
  await CouponModel.updateOne(
    { _id: toObjectId(id) },
    { $set: { "provider.discountId": provider.discountId, "provider.syncedAt": provider.syncedAt } },
    { session },
  );
}

// Adds 1 to the redemption counter. Runs inside the transaction of an order.
export async function incrementRedemptions(id: string, session: ClientSession): Promise<void> {
  await connectDB();
  await CouponModel.updateOne({ _id: toObjectId(id) }, { $inc: { redemptionsCount: 1 } }, { session });
}
