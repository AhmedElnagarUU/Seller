import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import {
  ANNOUNCEMENT_AUDIENCES,
  INTERNAL_PATH_PATTERN,
  JOB_ERROR_MAX,
  NOTIFICATION_BODY_MAX,
  NOTIFICATION_BODY_MIN,
  NOTIFICATION_JOB_KINDS,
  NOTIFICATION_JOB_STAGES,
  NOTIFICATION_JOB_STATUSES,
  NOTIFICATION_LINK_MAX,
  NOTIFICATION_TITLE_MAX,
  NOTIFICATION_TITLE_MIN,
} from "@/features/notifications/notification.constants";

// The message of an announcement job. Every field is null for the other kinds.
const announcementSchema = new Schema(
  {
    // Title of the announcement.
    title: {
      type: String,
      default: null,
      trim: true,
      minlength: NOTIFICATION_TITLE_MIN,
      maxlength: NOTIFICATION_TITLE_MAX,
    },
    // Text of the announcement.
    body: {
      type: String,
      default: null,
      trim: true,
      minlength: NOTIFICATION_BODY_MIN,
      maxlength: NOTIFICATION_BODY_MAX,
    },
    // Where clicking the notification goes. An internal path.
    link: { type: String, default: null, match: INTERNAL_PATH_PATTERN, maxlength: NOTIFICATION_LINK_MAX },
    // true = also send it by email.
    sendEmail: { type: Boolean, default: null },
    // Who gets it.
    audience: { type: String, enum: ANNOUNCEMENT_AUDIENCES, default: null },
    // The theme whose owners get it (audience "theme_owners").
    audienceThemeId: { type: Schema.Types.ObjectId, ref: "Theme", default: null },
    // The customer who gets it (audience "one_customer").
    audienceUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

// A notification that must reach many users (docs/03-data-model.md section 13, D-116).
const notificationJobSchema = new Schema(
  {
    // What caused the job.
    kind: { type: String, required: true, enum: NOTIFICATION_JOB_KINDS },
    // Required for "version_released" and "theme_published".
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", default: null },
    // Required for "version_released".
    versionId: { type: Schema.Types.ObjectId, ref: "Version", default: null },
    // Required for "theme_published".
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    // Required for "announcement".
    announcement: { type: announcementSchema, required: true, default: () => ({}) },
    // Where the job is in its life.
    status: { type: String, required: true, enum: NOTIFICATION_JOB_STATUSES, default: "pending" },
    // Which group is being processed now. Starts at the first stage of the kind.
    stage: { type: String, required: true, enum: NOTIFICATION_JOB_STAGES },
    // `_id` of the last source row processed in the current stage.
    cursor: { type: Schema.Types.ObjectId, default: null },
    // How many in-app notifications were created.
    notifiedCount: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
    // How many emails were sent.
    emailedCount: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
    // Failed batches; after 5 the job becomes "failed".
    attempts: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
    // The last error, for the admin.
    error: { type: String, default: null, maxlength: JOB_ERROR_MAX },
    // When the first batch started.
    startedAt: { type: Date, default: null },
    // When the job became "done" or "failed".
    finishedAt: { type: Date, default: null },
    // A cron run is working on this job until this time (docs/09-emails.md 5.3).
    lockedUntil: { type: Date, default: null },
    // The admin who caused it.
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "notificationJobs", timestamps: true },
);

// The paths that must have a value for this job ("Required for ..." in docs/03-data-model.md section 13).
function requiredPathsOf(kind: unknown, audience: unknown): string[] {
  const paths: string[] = [];
  if (kind === "version_released") paths.push("themeId", "versionId");
  if (kind === "theme_published") paths.push("themeId", "categoryId");
  if (kind === "announcement") {
    paths.push("announcement.title", "announcement.body", "announcement.sendEmail", "announcement.audience");
  }
  if (audience === "theme_owners") paths.push("announcement.audienceThemeId");
  if (audience === "one_customer") paths.push("announcement.audienceUserId");
  return paths;
}

// Required-by-kind rules. `false` counts as given: only null (or nothing) is missing.
notificationJobSchema.pre("validate", function () {
  for (const path of requiredPathsOf(this.get("kind"), this.get("announcement.audience"))) {
    const value: unknown = this.get(path);
    if (value === null || value === undefined) this.invalidate(path, `Path \`${path}\` is required.`);
  }
});

// The cron picks the oldest pending or running job.
notificationJobSchema.index({ status: 1, createdAt: 1 });

export type NotificationJobRecord = InferSchemaType<typeof notificationJobSchema> & { _id: Types.ObjectId };

// `models.NotificationJob ||` stops hot reload from defining the model twice.
export const NotificationJobModel =
  (models.NotificationJob as Model<NotificationJobRecord>) ||
  model<NotificationJobRecord>("NotificationJob", notificationJobSchema);
