import type { ClientSession } from "mongoose";
import { toObjectId } from "@/shared/db/ids";
import { now } from "@/shared/lib/clock";
import {
  ACTIVITIES_PER_PAGE,
  ADMIN_ACTOR_LABEL,
  SYSTEM_ACTOR_LABEL,
  UNKNOWN_CUSTOMER_ACTOR_LABEL,
  type ActivityAction,
} from "@/features/activity/activity.constants";
import type { ActivityLogRecord } from "@/features/activity/activity-log.model";
import * as activityLogRepository from "@/features/activity/activity-log.repository";
import type { ActivityLogQuery } from "@/features/activity/activity-log.repository";
import { toActivityLogDTO } from "@/features/activity/activity.mapper";
import type { ActivityLogInput, ActivityPageDTO } from "@/features/activity/activity.types";
import { getUserIdByEmail, getUserNames } from "@/features/users/user.service";

type ListActivityInput = {
  action?: ActivityAction;
  customerEmail?: string;
  page?: number;
};

const SYSTEM_ACTOR_MESSAGE = "A system activity entry cannot have an actor user.";

function toOptionalObjectId(id: string | null | undefined) {
  return id ? toObjectId(id) : null;
}

async function writeEntry(input: ActivityLogInput, session?: ClientSession): Promise<void> {
  if (input.actorRole === "system" && input.actorUserId) throw new Error(SYSTEM_ACTOR_MESSAGE);
  await activityLogRepository.insertActivityLog(
    {
      action: input.action,
      actorRole: input.actorRole,
      actorUserId: toOptionalObjectId(input.actorUserId),
      subjectUserId: toOptionalObjectId(input.subjectUserId),
      targetType: input.targetType ?? null,
      targetId: toOptionalObjectId(input.targetId),
      summary: input.summary,
      createdAt: now(),
    },
    session,
  );
}

// Writes one row of the activity log. With a session (inside a transaction) every error is thrown, so the
// transaction rolls back. Without a session it never throws: logging must not break the main action.
export async function log(input: ActivityLogInput, session?: ClientSession): Promise<void> {
  if (session) {
    await writeEntry(input, session);
    return;
  }
  try {
    await writeEntry(input);
  } catch (error) {
    // Never the summary: it can hold customer data.
    console.error("activity log failed", input.action, error);
  }
}

function actorLabelOf(record: ActivityLogRecord, customerNames: Map<string, string>): string {
  if (record.actorRole === "system") return SYSTEM_ACTOR_LABEL;
  if (record.actorRole === "admin") return ADMIN_ACTOR_LABEL;
  const name = record.actorUserId ? customerNames.get(record.actorUserId.toString()) : undefined;
  return name ?? UNKNOWN_CUSTOMER_ACTOR_LABEL;
}

function customerActorIdsOf(records: ActivityLogRecord[]): string[] {
  const ids = new Set<string>();
  for (const record of records) {
    if (record.actorRole === "customer" && record.actorUserId) ids.add(record.actorUserId.toString());
  }
  return [...ids];
}

// One page of the activity log for the admin, newest first.
export async function listActivity(input: ListActivityInput): Promise<ActivityPageDTO> {
  const page = Math.max(1, input.page ?? 1);
  const customerEmail = input.customerEmail?.trim().toLowerCase() ?? "";
  const query: ActivityLogQuery = { action: input.action };
  if (customerEmail) {
    const customerId = await getUserIdByEmail(customerEmail);
    if (!customerId) return { items: [], page, totalPages: 0, total: 0 };
    query.subjectUserId = customerId;
  }
  const [records, total] = await Promise.all([
    activityLogRepository.findActivityLogs(query, page, ACTIVITIES_PER_PAGE),
    activityLogRepository.countActivityLogs(query),
  ]);
  const customerNames = await getUserNames(customerActorIdsOf(records));
  return {
    items: records.map((record) => toActivityLogDTO(record, actorLabelOf(record, customerNames))),
    page,
    totalPages: Math.ceil(total / ACTIVITIES_PER_PAGE),
    total,
  };
}
