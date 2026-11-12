import type { ClientSession } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { parseObjectId, toObjectId } from "@/shared/db/ids";
import type { ChangeType } from "@/features/versions/version.constants";
import { VersionModel, type VersionRecord } from "@/features/versions/version.model";

const MONGO_DUPLICATE_KEY_CODE = 11000;

export type ChangeFields = { type: ChangeType; text: string };

// Every field of a new version.
export type VersionFields = {
  themeId: string;
  version: string;
  changes: ChangeFields[];
  file: { key: string; sizeBytes: number; sha256: string; originalName: string };
  releasedAt: Date;
  notifyRequested: boolean;
};

// Which unique index refused a write: the version number of the theme, or the file key.
export type DuplicateKeyField = "version" | "fileKey";

// Inserts one version. With a session the write is part of that transaction.
export async function insertVersion(fields: VersionFields, session?: ClientSession): Promise<VersionRecord> {
  await connectDB();
  const [created] = await VersionModel.create([{ ...fields, themeId: toObjectId(fields.themeId) }], { session });
  if (!created) throw new Error("The version was not created.");
  return created.toObject();
}

// Finds a version by id, or null (also when the id is not a valid id).
export async function findVersionById(id: string): Promise<VersionRecord | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  await connectDB();
  return VersionModel.findById(objectId).lean<VersionRecord>();
}

// All versions of a theme, newest first.
export async function findVersionsByThemeId(themeId: string): Promise<VersionRecord[]> {
  await connectDB();
  return VersionModel.find({ themeId: toObjectId(themeId) })
    .sort({ releasedAt: -1, _id: -1 })
    .lean<VersionRecord[]>();
}

export async function countVersionsByThemeId(themeId: string): Promise<number> {
  await connectDB();
  return VersionModel.countDocuments({ themeId: toObjectId(themeId) });
}

// True when a version already uses this file.
export async function existsVersionByFileKey(fileKey: string): Promise<boolean> {
  await connectDB();
  const found = await VersionModel.exists({ "file.key": fileKey });
  return found !== null;
}

// Remembers the notification job of a version.
export async function setVersionNotificationJobId(
  versionId: string,
  jobId: string,
  session?: ClientSession,
): Promise<void> {
  await connectDB();
  await VersionModel.updateOne(
    { _id: toObjectId(versionId) },
    { $set: { notificationJobId: toObjectId(jobId) } },
    { session },
  );
}

// Replaces the changelog and nothing else. Returns the version, or null when it does not exist (or the id is invalid).
export async function updateVersionChangesById(
  versionId: string,
  changes: ChangeFields[],
): Promise<VersionRecord | null> {
  const objectId = parseObjectId(versionId);
  if (!objectId) return null;
  await connectDB();
  return VersionModel.findByIdAndUpdate(
    objectId,
    { $set: { changes } },
    { returnDocument: "after", runValidators: true },
  ).lean<VersionRecord>();
}

function hasKey(value: unknown, key: string): boolean {
  return typeof value === "object" && value !== null && key in value;
}

// Tells which unique index caused a duplicate key error. null for every other error.
export function findDuplicateKeyField(error: unknown): DuplicateKeyField | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  if (error.code !== MONGO_DUPLICATE_KEY_CODE) return null;
  const keyPattern = "keyPattern" in error ? error.keyPattern : null;
  if (hasKey(keyPattern, "file.key")) return "fileKey";
  if (hasKey(keyPattern, "version")) return "version";
  return null;
}
