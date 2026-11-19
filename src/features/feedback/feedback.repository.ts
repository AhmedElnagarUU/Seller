import type { ClientSession } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { parseObjectId, toObjectId } from "@/shared/db/ids";
import type { FeedbackStatus } from "@/features/feedback/feedback.constants";
import { FeedbackModel, type FeedbackRecord } from "@/features/feedback/feedback.model";

// Inserts a message: status "new", no reply.
export async function insertFeedback(userId: string, subject: string, message: string): Promise<FeedbackRecord> {
  await connectDB();
  const created = await FeedbackModel.create({ userId: toObjectId(userId), subject, message });
  return created.toObject();
}

// How many messages this user created at or after `since`.
export async function countFeedbackSince(userId: string, since: Date): Promise<number> {
  await connectDB();
  return FeedbackModel.countDocuments({ userId: toObjectId(userId), createdAt: { $gte: since } });
}

// Finds a message by id, or null (also when the id is not a valid id).
export async function findFeedbackById(id: string, session?: ClientSession): Promise<FeedbackRecord | null> {
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  await connectDB();
  return FeedbackModel.findById(objectId, null, { session }).lean<FeedbackRecord>();
}

// The messages of one user, newest first.
export async function listFeedbackByUser(userId: string): Promise<FeedbackRecord[]> {
  await connectDB();
  return FeedbackModel.find({ userId: toObjectId(userId) })
    .sort({ createdAt: -1, _id: -1 })
    .lean<FeedbackRecord[]>();
}

// One page (page 1 is the first) of the messages with this status, newest first.
export async function findFeedbackPage(
  status: FeedbackStatus,
  page: number,
  pageSize: number,
): Promise<FeedbackRecord[]> {
  await connectDB();
  return FeedbackModel.find({ status })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean<FeedbackRecord[]>();
}

export async function countFeedback(status: FeedbackStatus): Promise<number> {
  await connectDB();
  return FeedbackModel.countDocuments({ status });
}

// Sets "new" to "read". Other statuses stay as they are.
export async function markFeedbackReadIfNew(id: string): Promise<void> {
  await connectDB();
  await FeedbackModel.updateOne({ _id: toObjectId(id), status: "new" }, { $set: { status: "read" } });
}

// Saves the reply of a message that has none yet. Returns the updated row, or null when the message is missing
// or already has a reply. The status is not changed.
export async function setFeedbackReply(
  id: string,
  reply: string,
  repliedAt: Date,
  adminUserId: string,
  session?: ClientSession,
): Promise<FeedbackRecord | null> {
  await connectDB();
  return FeedbackModel.findOneAndUpdate(
    { _id: toObjectId(id), reply: null },
    { $set: { reply, repliedAt, repliedByUserId: toObjectId(adminUserId) } },
    { returnDocument: "after", runValidators: true, session },
  ).lean<FeedbackRecord>();
}

// Sets the status. Returns the updated row, or null when the message is missing.
export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<FeedbackRecord | null> {
  await connectDB();
  return FeedbackModel.findByIdAndUpdate(
    toObjectId(id),
    { $set: { status } },
    { returnDocument: "after" },
  ).lean<FeedbackRecord>();
}

// The number of messages with this status (the menu badge and the dashboard).
export async function countFeedbackByStatus(status: FeedbackStatus): Promise<number> {
  await connectDB();
  return FeedbackModel.countDocuments({ status });
}
