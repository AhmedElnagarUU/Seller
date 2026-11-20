import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { AUTH_ATTEMPT_KINDS, AUTH_ATTEMPT_RETENTION_SECONDS } from "@/features/auth/auth-limit.constants";

// One failed login or one sent auth email, kept only for the limits of D-150 (docs/03-data-model.md section 20).
const authAttemptSchema = new Schema(
  {
    // What happened.
    kind: { type: String, enum: AUTH_ATTEMPT_KINDS, required: true },
    // The address the attempt was for.
    email: { type: String, required: true, trim: true, lowercase: true },
    // The client IP, or "unknown" when it cannot be read.
    ip: { type: String, required: true },
  },
  { collection: "authAttempts", timestamps: { createdAt: true, updatedAt: false } },
);

// The limit per email and IP.
authAttemptSchema.index({ kind: 1, email: 1, ip: 1, createdAt: -1 });
// The limit per IP.
authAttemptSchema.index({ kind: 1, ip: 1, createdAt: -1 });
// The database removes rows after 1 day.
authAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: AUTH_ATTEMPT_RETENTION_SECONDS });

export type AuthAttemptRecord = InferSchemaType<typeof authAttemptSchema> & { _id: Types.ObjectId };

// `models.AuthAttempt ||` stops hot reload from defining the model twice.
export const AuthAttemptModel =
  (models.AuthAttempt as Model<AuthAttemptRecord>) || model<AuthAttemptRecord>("AuthAttempt", authAttemptSchema);
