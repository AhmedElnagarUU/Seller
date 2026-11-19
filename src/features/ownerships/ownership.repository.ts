import type { ClientSession, Types } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { parseObjectId, toObjectId } from "@/shared/db/ids";
import type { OwnershipSource, RevokeReason } from "@/features/ownerships/ownership.constants";
import { OwnershipModel, type OwnershipRecord } from "@/features/ownerships/ownership.model";

// The fields that say how a customer got a theme.
export type GrantFields = {
  source: OwnershipSource;
  orderId: string | null;
  grantedByUserId: string | null;
  grantNote: string | null;
};

// The fields of a new ownership. It starts active.
export type NewOwnershipFields = GrantFields & { userId: string; themeId: string };

// The fields that say why a customer lost a theme.
export type RevokeFields = {
  revokedAt: Date;
  revokedReason: RevokeReason;
  revokedByUserId: string | null;
  revokeNote: string | null;
};

function toOptionalObjectId(id: string | null) {
  return id ? toObjectId(id) : null;
}

// Finds the ownership of a user and a theme, any status. null when none exists or an id is invalid.
export async function findOwnershipByUserAndTheme(
  userId: string,
  themeId: string,
  session?: ClientSession,
): Promise<OwnershipRecord | null> {
  const userObjectId = parseObjectId(userId);
  const themeObjectId = parseObjectId(themeId);
  if (!userObjectId || !themeObjectId) return null;
  await connectDB();
  return OwnershipModel.findOne({ userId: userObjectId, themeId: themeObjectId }, null, {
    session,
  }).lean<OwnershipRecord>();
}

// True when an active ownership exists. false for invalid ids.
export async function existsActiveOwnership(userId: string, themeId: string): Promise<boolean> {
  const userObjectId = parseObjectId(userId);
  const themeObjectId = parseObjectId(themeId);
  if (!userObjectId || !themeObjectId) return false;
  await connectDB();
  const found = await OwnershipModel.exists({ userId: userObjectId, themeId: themeObjectId, status: "active" });
  return found !== null;
}

// The active ownerships of a user. An invalid id gives an empty list.
export async function findActiveOwnershipsByUserId(userId: string): Promise<OwnershipRecord[]> {
  const userObjectId = parseObjectId(userId);
  if (!userObjectId) return [];
  await connectDB();
  return OwnershipModel.find({ userId: userObjectId, status: "active" }).lean<OwnershipRecord[]>();
}

// Inserts an active ownership. With a session the write is part of that transaction.
export async function insertOwnership(fields: NewOwnershipFields, session?: ClientSession): Promise<OwnershipRecord> {
  await connectDB();
  const [created] = await OwnershipModel.create(
    [
      {
        userId: toObjectId(fields.userId),
        themeId: toObjectId(fields.themeId),
        status: "active",
        source: fields.source,
        orderId: toOptionalObjectId(fields.orderId),
        grantedByUserId: toOptionalObjectId(fields.grantedByUserId),
        grantNote: fields.grantNote,
        licenseType: "standard",
        revokedAt: null,
        revokedReason: null,
        revokedByUserId: null,
        revokeNote: null,
      },
    ],
    { session },
  );
  if (!created) throw new Error("The ownership was not created.");
  return created.toObject();
}

// Makes a revoked ownership active again: new grant data, and every revoked field back to null.
export async function activateOwnershipById(id: string, fields: GrantFields, session?: ClientSession): Promise<void> {
  await connectDB();
  await OwnershipModel.updateOne(
    { _id: toObjectId(id) },
    {
      $set: {
        status: "active",
        source: fields.source,
        orderId: toOptionalObjectId(fields.orderId),
        grantedByUserId: toOptionalObjectId(fields.grantedByUserId),
        grantNote: fields.grantNote,
        revokedAt: null,
        revokedReason: null,
        revokedByUserId: null,
        revokeNote: null,
      },
    },
    { session },
  );
}

// Revokes an ownership that is active. Returns true when a row changed.
export async function revokeOwnershipById(id: string, fields: RevokeFields, session?: ClientSession): Promise<boolean> {
  await connectDB();
  const result = await OwnershipModel.updateOne(
    { _id: toObjectId(id), status: "active" },
    {
      $set: {
        status: "revoked",
        revokedAt: fields.revokedAt,
        revokedReason: fields.revokedReason,
        revokedByUserId: toOptionalObjectId(fields.revokedByUserId),
        revokeNote: fields.revokeNote,
      },
    },
    { session },
  );
  return result.modifiedCount === 1;
}

// The next active ownerships of a theme, `_id` ascending, after `afterId` (all when null). Only `_id` and `userId`.
// An invalid theme id or cursor gives no rows.
export async function findActiveOwnerRowsAfter(input: {
  themeId: string;
  afterId: string | null;
  limit: number;
}): Promise<{ _id: Types.ObjectId; userId: Types.ObjectId }[]> {
  const themeObjectId = parseObjectId(input.themeId);
  if (!themeObjectId) return [];
  const afterObjectId = input.afterId === null ? null : parseObjectId(input.afterId);
  if (input.afterId !== null && !afterObjectId) return [];
  await connectDB();
  const filter = {
    themeId: themeObjectId,
    status: "active" as const,
    ...(afterObjectId ? { _id: { $gt: afterObjectId } } : {}),
  };
  return OwnershipModel.find(filter)
    .sort({ _id: 1 })
    .limit(input.limit)
    .select({ userId: 1 })
    .lean<{ _id: Types.ObjectId; userId: Types.ObjectId }[]>();
}

// How many active ownerships each user has. Users without any are missing from the map. Invalid ids are ignored.
export async function countActiveByUsers(userIds: string[]): Promise<Map<string, number>> {
  const objectIds = userIds.map(parseObjectId).filter((objectId) => objectId !== null);
  if (objectIds.length === 0) return new Map();
  await connectDB();
  const rows = await OwnershipModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { status: "active", userId: { $in: objectIds } } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}
