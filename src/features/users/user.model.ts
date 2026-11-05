import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

// The `user` collection belongs to Better Auth. Core fields (name, email, emailVerified) are read only here:
// they change only through Better Auth APIs. Our code writes only the extra fields (docs/03-data-model.md section 3).
const userSchema = new Schema(
  {
    // Core field owned by Better Auth. Never written with Mongoose.
    name: { type: String, required: true },
    // Core field owned by Better Auth. Never written with Mongoose.
    email: { type: String, required: true },
    // Core field owned by Better Auth. Never written with Mongoose.
    emailVerified: { type: Boolean, default: false },
    // ISO 3166-1 alpha-2 code, e.g. "EG". Set at registration or first checkout (D-102).
    country: { type: String, default: null, match: /^[A-Z]{2}$/ },
    // true = cannot log in (D-120).
    disabled: { type: Boolean, required: true, default: false },
    // Why the account was disabled. Shown to the admin only. Max 300 chars.
    disabledReason: { type: String, default: null, trim: true, maxlength: 300 },
    // When the account was disabled.
    disabledAt: { type: Date, default: null },
    // Email switch: new version of a theme the user owns.
    emailOwnedThemeUpdates: { type: Boolean, required: true, default: true },
    // Email switch: new version of a theme the user favorited.
    emailFavoriteThemeUpdates: { type: Boolean, required: true, default: true },
    // Email switch: new theme in a followed category.
    emailFollowedCategoryThemes: { type: Boolean, required: true, default: true },
    // Email switch: announcements.
    emailAnnouncements: { type: Boolean, required: true, default: true },
  },
  { collection: "user", timestamps: true, strict: true },
);

// Admin customer list filter.
userSchema.index({ disabled: 1, createdAt: -1 });

export type UserRecord = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

// `models.User ||` stops hot reload from defining the model twice.
export const UserModel = (models.User as Model<UserRecord>) || model<UserRecord>("User", userSchema);
