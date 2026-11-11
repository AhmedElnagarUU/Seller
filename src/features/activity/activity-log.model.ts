import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTOR_ROLES,
  ACTIVITY_RETENTION_SECONDS,
  ACTIVITY_SUMMARY_MAX,
  ACTIVITY_SUMMARY_MIN,
  ACTIVITY_TARGET_TYPES,
} from "@/features/activity/activity.constants";

// One line of the activity log (docs/03-data-model.md section 15). Append-only: rows are never changed.
const activityLogSchema = new Schema(
  {
    // What happened, e.g. "order_paid".
    action: { type: String, required: true, enum: ACTIVITY_ACTIONS },
    // Who did it. "system" = webhooks and cron.
    actorRole: { type: String, required: true, enum: ACTIVITY_ACTOR_ROLES },
    // The user who did it. null when actorRole is "system".
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // The customer this is about (used by the customer filter).
    subjectUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // The kind of thing this is about, e.g. "theme".
    targetType: { type: String, enum: ACTIVITY_TARGET_TYPES, default: null },
    // The id of that thing.
    targetId: { type: Schema.Types.ObjectId, default: null },
    // A readable sentence, e.g. "Order paid: Aurora Blog ($29.00)". No secrets.
    summary: {
      type: String,
      required: true,
      trim: true,
      minlength: ACTIVITY_SUMMARY_MIN,
      maxlength: ACTIVITY_SUMMARY_MAX,
    },
  },
  { collection: "activityLogs", timestamps: true },
);

// The database removes rows after 1 year (D-123). Also used for newest-first sorting.
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: ACTIVITY_RETENTION_SECONDS });
// Customer filter.
activityLogSchema.index({ subjectUserId: 1, createdAt: -1 });
// Action filter.
activityLogSchema.index({ action: 1, createdAt: -1 });

export type ActivityLogRecord = InferSchemaType<typeof activityLogSchema> & { _id: Types.ObjectId };

// `models.ActivityLog ||` stops hot reload from defining the model twice.
export const ActivityLogModel =
  (models.ActivityLog as Model<ActivityLogRecord>) || model<ActivityLogRecord>("ActivityLog", activityLogSchema);
