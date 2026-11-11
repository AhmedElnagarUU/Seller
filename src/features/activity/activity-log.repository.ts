import type { ClientSession } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { toObjectId } from "@/shared/db/ids";
import type { ActivityAction } from "@/features/activity/activity.constants";
import { ActivityLogModel, type ActivityLogRecord } from "@/features/activity/activity-log.model";

// The fields of a new row.
export type ActivityLogFields = Pick<
  ActivityLogRecord,
  "action" | "actorRole" | "actorUserId" | "subjectUserId" | "targetType" | "targetId" | "summary" | "createdAt"
>;

// What to look for. Every field is optional; the ones given are combined with AND.
export type ActivityLogQuery = {
  action?: ActivityAction;
  subjectUserId?: string;
};

type MongoFilter = Record<string, unknown>;

function buildFilter(query: ActivityLogQuery): MongoFilter {
  const filter: MongoFilter = {};
  if (query.action) filter.action = query.action;
  if (query.subjectUserId) filter.subjectUserId = toObjectId(query.subjectUserId);
  return filter;
}

// Inserts one row. With a session the write is part of that transaction.
export async function insertActivityLog(fields: ActivityLogFields, session?: ClientSession): Promise<void> {
  await connectDB();
  await ActivityLogModel.create([fields], { session });
}

// Finds one page of rows, newest first. Pages are numbered from 1.
export async function findActivityLogs(
  query: ActivityLogQuery,
  page: number,
  pageSize: number,
): Promise<ActivityLogRecord[]> {
  await connectDB();
  return ActivityLogModel.find(buildFilter(query))
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean<ActivityLogRecord[]>();
}

// Counts the rows that match.
export async function countActivityLogs(query: ActivityLogQuery): Promise<number> {
  await connectDB();
  return ActivityLogModel.countDocuments(buildFilter(query));
}
