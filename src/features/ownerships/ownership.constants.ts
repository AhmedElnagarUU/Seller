// docs/03-data-model.md section 8.
export const OWNERSHIP_STATUSES = ["active", "revoked"] as const;
export type OwnershipStatus = (typeof OWNERSHIP_STATUSES)[number];

export const OWNERSHIP_SOURCES = ["purchase", "admin_grant"] as const;
export type OwnershipSource = (typeof OWNERSHIP_SOURCES)[number];

// Only one license exists (D-006).
export const LICENSE_TYPES = ["standard"] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];

export const REVOKE_REASONS = ["refund", "admin"] as const;
export type RevokeReason = (typeof REVOKE_REASONS)[number];

export const OWNERSHIP_NOTE_MAX = 300;

export const OWNERSHIP_MESSAGES = {
  themeNotFound: "Theme not found.",
  customerNotFound: "Customer not found.",
  alreadyOwned: "This customer already owns this theme.",
  notOwned: "This customer does not own this theme.",
};
