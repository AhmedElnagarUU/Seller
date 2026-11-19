import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import {
  WEBHOOK_ERROR_MAX,
  WEBHOOK_EVENT_RETENTION_SECONDS,
  WEBHOOK_EVENT_STATUSES,
  WEBHOOK_PROVIDERS,
  WEBHOOK_TYPE_MAX,
} from "@/features/payments/webhook-event.constants";

// One payment webhook that we received (docs/03-data-model.md section 16). Makes webhooks safe to repeat.
// The body of the webhook is never saved.
const webhookEventSchema = new Schema(
  {
    provider: { type: String, required: true, enum: WEBHOOK_PROVIDERS },
    // The provider's event id (Polar: the webhook-id header).
    eventId: { type: String, required: true, trim: true },
    // For example "order.paid".
    type: { type: String, required: true, trim: true, maxlength: WEBHOOK_TYPE_MAX },
    status: { type: String, required: true, enum: WEBHOOK_EVENT_STATUSES },
    // Why the event failed. No secrets, no personal data.
    error: { type: String, default: null, trim: true, maxlength: WEBHOOK_ERROR_MAX },
    processedAt: { type: Date, default: null },
  },
  { collection: "webhookEvents", timestamps: true },
);

// The same event is never saved twice.
webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
// The database removes the rows after 90 days.
webhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: WEBHOOK_EVENT_RETENTION_SECONDS });

export type WebhookEventRecord = InferSchemaType<typeof webhookEventSchema> & { _id: Types.ObjectId };

// `models.WebhookEvent ||` stops hot reload from defining the model twice.
export const WebhookEventModel =
  (models.WebhookEvent as Model<WebhookEventRecord>) || model<WebhookEventRecord>("WebhookEvent", webhookEventSchema);
