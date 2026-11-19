import type { ClientSession } from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { toObjectId } from "@/shared/db/ids";
import type { WebhookEventStatus, WebhookProvider } from "@/features/payments/webhook-event.constants";
import { WebhookEventModel, type WebhookEventRecord } from "@/features/payments/webhook-event.model";

type NewEventFields = { provider: WebhookProvider; eventId: string; type: string };

// Inserts a new event in status "processing". Throws a duplicate-key error when it exists already.
export async function insertProcessingEvent(fields: NewEventFields): Promise<WebhookEventRecord> {
  await connectDB();
  const created = await WebhookEventModel.create({ ...fields, status: "processing", error: null, processedAt: null });
  return created.toObject();
}

// Finds an event by provider and event id, or null.
export async function findEvent(provider: WebhookProvider, eventId: string): Promise<WebhookEventRecord | null> {
  await connectDB();
  return WebhookEventModel.findOne({ provider, eventId }).lean<WebhookEventRecord>();
}

// Changes the status of an event. `error` is cleared unless it is given; `processedAt` is set only when it is given.
export async function setEventStatus(
  id: string,
  status: WebhookEventStatus,
  fields: { error?: string | null; processedAt?: Date } = {},
): Promise<void> {
  await connectDB();
  await WebhookEventModel.updateOne(
    { _id: toObjectId(id) },
    {
      $set: { status, error: fields.error ?? null, ...(fields.processedAt ? { processedAt: fields.processedAt } : {}) },
    },
  );
}

// Marks the event as processed. Part of the transaction of the session.
export async function markProcessed(id: string, processedAt: Date, session: ClientSession): Promise<void> {
  await connectDB();
  await WebhookEventModel.updateOne(
    { _id: toObjectId(id) },
    { $set: { status: "processed", error: null, processedAt } },
    { session },
  );
}

// Marks the event as failed and saves our message (never the body of the webhook).
export async function markFailed(id: string, error: string): Promise<void> {
  await setEventStatus(id, "failed", { error });
}
