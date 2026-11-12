import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import {
  INTERNAL_PATH_PATTERN,
  NOTIFICATION_BODY_MAX,
  NOTIFICATION_BODY_MIN,
  NOTIFICATION_LINK_MAX,
  NOTIFICATION_RETENTION_SECONDS,
  NOTIFICATION_TITLE_MAX,
  NOTIFICATION_TITLE_MIN,
  NOTIFICATION_TYPES,
} from "@/features/notifications/notification.constants";

// One message in one customer's notification center (docs/03-data-model.md section 12, D-111).
const notificationSchema = new Schema(
  {
    // The customer who sees it.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // What kind of message it is, e.g. "owned_theme_updated".
    type: { type: String, required: true, enum: NOTIFICATION_TYPES },
    // Short first line.
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: NOTIFICATION_TITLE_MIN,
      maxlength: NOTIFICATION_TITLE_MAX,
    },
    // Plain text.
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: NOTIFICATION_BODY_MIN,
      maxlength: NOTIFICATION_BODY_MAX,
    },
    // Where clicking the notification goes. An internal path such as "/account/themes".
    link: { type: String, default: null, match: INTERNAL_PATH_PATTERN, maxlength: NOTIFICATION_LINK_MAX },
    // null = unread.
    readAt: { type: Date, default: null },
    // Set when created by a job.
    jobId: { type: Schema.Types.ObjectId, ref: "NotificationJob", default: null },
  },
  { collection: "notifications", timestamps: true },
);

// Notification page.
notificationSchema.index({ userId: 1, createdAt: -1 });
// Unread count.
notificationSchema.index({ userId: 1, readAt: 1 });
// A job never notifies the same user twice. Partial: notifications without a job are not limited.
notificationSchema.index(
  { jobId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { jobId: { $type: "objectId" } } },
);
// The database removes rows after 1 year.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_RETENTION_SECONDS });

export type NotificationRecord = InferSchemaType<typeof notificationSchema> & { _id: Types.ObjectId };

// `models.Notification ||` stops hot reload from defining the model twice.
export const NotificationModel =
  (models.Notification as Model<NotificationRecord>) || model<NotificationRecord>("Notification", notificationSchema);
