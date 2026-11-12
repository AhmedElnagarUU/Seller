import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import {
  LICENSE_TYPES,
  OWNERSHIP_NOTE_MAX,
  OWNERSHIP_SOURCES,
  OWNERSHIP_STATUSES,
  REVOKE_REASONS,
} from "@/features/ownerships/ownership.constants";

// "This user can download this theme" (docs/03-data-model.md section 8). The only access rule for downloads.
const ownershipSchema = new Schema(
  {
    // The customer.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // The theme the customer may download.
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true },
    // "active" = may download, "revoked" = may not.
    status: { type: String, required: true, enum: OWNERSHIP_STATUSES },
    // How the customer got the theme.
    source: { type: String, required: true, enum: OWNERSHIP_SOURCES },
    // The order that paid for it. Required when source is "purchase".
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    // The admin who granted it. Required when source is "admin_grant".
    grantedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Why the admin granted it.
    grantNote: { type: String, default: null, trim: true, maxlength: OWNERSHIP_NOTE_MAX },
    // Only "standard" exists (D-006).
    licenseType: { type: String, required: true, enum: LICENSE_TYPES, default: "standard" },
    // When the access was removed.
    revokedAt: { type: Date, default: null },
    // Why the access was removed.
    revokedReason: { type: String, enum: REVOKE_REASONS, default: null },
    // The admin who removed it. Required when revokedReason is "admin".
    revokedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Why the admin removed it. Required when revokedReason is "admin".
    revokeNote: { type: String, default: null, trim: true, maxlength: OWNERSHIP_NOTE_MAX },
  },
  { collection: "ownerships", timestamps: true },
);

// At most one ownership per user and theme.
ownershipSchema.index({ userId: 1, themeId: 1 }, { unique: true });
// The notification fan-out walks the owners of a theme in _id order.
ownershipSchema.index({ themeId: 1, status: 1, _id: 1 });
// "My themes".
ownershipSchema.index({ userId: 1, status: 1 });

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

// The rules "required when ..." of docs/03-data-model.md section 8.
ownershipSchema.pre("validate", function () {
  const requirePath = (path: string): void => {
    if (isMissing(this.get(path))) this.invalidate(path, `Path \`${path}\` is required.`);
  };
  if (this.get("source") === "purchase") requirePath("orderId");
  if (this.get("source") === "admin_grant") requirePath("grantedByUserId");
  if (this.get("revokedReason") === "admin") {
    requirePath("revokedByUserId");
    requirePath("revokeNote");
  }
});

export type OwnershipRecord = InferSchemaType<typeof ownershipSchema> & { _id: Types.ObjectId };

// `models.Ownership ||` stops hot reload from defining the model twice.
export const OwnershipModel =
  (models.Ownership as Model<OwnershipRecord>) || model<OwnershipRecord>("Ownership", ownershipSchema);
