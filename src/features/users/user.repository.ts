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
