import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { DOWNLOAD_LOG_RETENTION_SECONDS } from "@/features/downloads/download.constants";

// One download of a zip (docs/03-data-model.md section 17). Used for the rate limit and the download counts.
const downloadLogSchema = new Schema(
  {
    // The customer who downloaded.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // The theme that was downloaded.
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true },
    // The version that was downloaded.
    versionId: { type: Schema.Types.ObjectId, ref: "Version", required: true },
  },
  { collection: "downloadLogs", timestamps: true },
);

// The rate limit.
downloadLogSchema.index({ userId: 1, createdAt: -1 });
// Top themes by downloads.
downloadLogSchema.index({ themeId: 1, createdAt: -1 });
// The database removes rows after 1 year (D-148).
downloadLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: DOWNLOAD_LOG_RETENTION_SECONDS });

export type DownloadLogRecord = InferSchemaType<typeof downloadLogSchema> & { _id: Types.ObjectId };

// `models.DownloadLog ||` stops hot reload from defining the model twice.
export const DownloadLogModel =
  (models.DownloadLog as Model<DownloadLogRecord>) || model<DownloadLogRecord>("DownloadLog", downloadLogSchema);
