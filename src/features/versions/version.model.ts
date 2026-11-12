import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import {
  CHANGE_TEXT_MAX,
  CHANGE_TEXT_MIN,
  CHANGE_TYPES,
  FILE_NAME_MAX,
  MAX_CHANGES,
  MAX_ZIP_BYTES,
  SEMVER_PATTERN,
  SHA256_PATTERN,
} from "@/features/versions/version.constants";

// One line of the changelog.
const changeEntrySchema = new Schema(
  {
    // What kind of change it is.
    type: { type: String, required: true, enum: CHANGE_TYPES },
    // Plain text shown to the customer.
    text: { type: String, required: true, trim: true, minlength: CHANGE_TEXT_MIN, maxlength: CHANGE_TEXT_MAX },
  },
  { _id: false },
);

// The uploaded zip in the private bucket.
const fileSchema = new Schema(
  {
    // Object key in the private bucket.
    key: { type: String, required: true },
    // Size of the zip. Integer, 1 byte up to 200 MB.
    sizeBytes: { type: Number, required: true, min: 1, max: MAX_ZIP_BYTES, validate: Number.isInteger },
    // SHA-256 of the zip as lowercase hex, calculated by the server after the upload.
    sha256: { type: String, required: true, match: SHA256_PATTERN },
    // The file name on the admin's computer. Not used for downloads.
    originalName: { type: String, required: true, trim: true, maxlength: FILE_NAME_MAX },
  },
  { _id: false },
);

function hasAllowedChangeCount(changes: unknown[]): boolean {
  return changes.length >= 1 && changes.length <= MAX_CHANGES;
}

const versionSchema = new Schema(
  {
    // The theme this zip belongs to.
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true },
    // Semver like "1.4.0". Higher than the theme's latest version. Unique per theme.
    version: { type: String, required: true, trim: true, match: SEMVER_PATTERN },
    // The changelog: 1 to 50 lines. The only field that can change after creation.
    changes: { type: [changeEntrySchema], required: true, validate: hasAllowedChangeCount },
    // The uploaded zip.
    file: { type: fileSchema, required: true },
    // When the version was created.
    releasedAt: { type: Date, required: true },
    // true = the admin ticked "Notify owners and people who favorited this theme".
    notifyRequested: { type: Boolean, required: true },
    // The notification job created for this version. Set when notifyRequested is true.
    notificationJobId: { type: Schema.Types.ObjectId, ref: "NotificationJob", default: null },
  },
  { collection: "themeVersions", timestamps: true },
);

versionSchema.index({ themeId: 1, version: 1 }, { unique: true });
// One uploaded file belongs to exactly one version (D-015).
versionSchema.index({ "file.key": 1 }, { unique: true });
versionSchema.index({ themeId: 1, releasedAt: -1 });

export type VersionRecord = InferSchemaType<typeof versionSchema> & { _id: Types.ObjectId };

// `models.Version ||` stops hot reload from defining the model twice.
export const VersionModel = (models.Version as Model<VersionRecord>) || model<VersionRecord>("Version", versionSchema);
