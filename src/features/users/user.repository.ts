import type { Types } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { parseObjectId, toObjectId } from "@/shared/db/ids";
import { UserModel, type UserRecord } from "@/features/users/user.model";

// Finds a user by id, or null.
export async function findUserById(id: string): Promise<UserRecord | null> {
  await connectDB();
  return UserModel.findById(toObjectId(id)).lean<UserRecord>();
}

// Saves the country code. Only our extra field is written, never the Better Auth core fields.
export async function setUserCountry(id: string, country: string): Promise<void> {
  await connectDB();
  await UserModel.updateOne({ _id: toObjectId(id) }, { $set: { country } });
}

// True when the user exists and is disabled.
export async function isUserDisabledById(id: string): Promise<boolean> {
  await connectDB();
  const user = await UserModel.findById(toObjectId(id)).select({ disabled: 1 }).lean<Pick<UserRecord, "disabled">>();
  return user?.disabled === true;
}

// Finds a user by email, or null. The email must already be lowercased.
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await connectDB();
  return UserModel.findOne({ email }).lean<UserRecord>();
}

// Finds the users with these ids. Invalid ids are ignored. Returns only `_id` and `name`.
export async function findUsersByIds(ids: string[]): Promise<Pick<UserRecord, "_id" | "name">[]> {
  const objectIds = ids.map(parseObjectId).filter((objectId) => objectId !== null);
  if (objectIds.length === 0) return [];
  await connectDB();
  return UserModel.find({ _id: { $in: objectIds } })
    .select({ name: 1 })
    .lean<Pick<UserRecord, "_id" | "name">[]>();
}

// Finds a user by id, or null (also when the id is not a valid id).
export async function findUserSummaryById(
  id: string,
): Promise<Pick<UserRecord, "_id" | "name" | "email" | "country"> | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  await connectDB();
  return UserModel.findById(objectId)
    .select({ name: 1, email: 1, country: 1 })
    .lean<Pick<UserRecord, "_id" | "name" | "email" | "country">>();
}

// Finds the users with these ids. Invalid and unknown ids are skipped. One query.
export async function findUserSummariesByIds(
  ids: string[],
): Promise<Pick<UserRecord, "_id" | "name" | "email" | "country">[]> {
  const objectIds = ids.map(parseObjectId).filter((objectId) => objectId !== null);
  if (objectIds.length === 0) return [];
  await connectDB();
  return UserModel.find({ _id: { $in: objectIds } })
    .select({ name: 1, email: 1, country: 1 })
    .lean<Pick<UserRecord, "_id" | "name" | "email" | "country">[]>();
}

// The fields that notifications need.
export type NotificationUserRecord = Pick<
  UserRecord,
  | "_id"
  | "name"
  | "email"
  | "disabled"
  | "emailOwnedThemeUpdates"
  | "emailFavoriteThemeUpdates"
  | "emailFollowedCategoryThemes"
  | "emailAnnouncements"
>;

// Finds the users with these ids. Invalid and unknown ids are skipped. One query.
export async function findNotificationUsersByIds(ids: string[]): Promise<NotificationUserRecord[]> {
  const objectIds = ids.map(parseObjectId).filter((objectId) => objectId !== null);
  if (objectIds.length === 0) return [];
  await connectDB();
  return UserModel.find({ _id: { $in: objectIds } })
    .select({
      name: 1,
      email: 1,
      disabled: 1,
      emailOwnedThemeUpdates: 1,
      emailFavoriteThemeUpdates: 1,
      emailFollowedCategoryThemes: 1,
      emailAnnouncements: 1,
    })
    .lean<NotificationUserRecord[]>();
}

// The ids of the next users that are not disabled, `_id` ascending, after `afterId` (all when null).
export async function findEnabledUserIdsAfter(input: {
  afterId: string | null;
  limit: number;
}): Promise<Pick<UserRecord, "_id">[]> {
  const afterObjectId = input.afterId === null ? null : parseObjectId(input.afterId);
  if (input.afterId !== null && !afterObjectId) return [];
  await connectDB();
  const filter = { disabled: false, ...(afterObjectId ? { _id: { $gt: afterObjectId } } : {}) };
  return UserModel.find(filter)
    .sort({ _id: 1 })
    .limit(input.limit)
    .select({ _id: 1 })
    .lean<{ _id: Types.ObjectId }[]>();
}
