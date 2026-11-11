import { randomBytes } from "node:crypto";

// Key builders and prefix helpers (docs/07-delivery-updates.md section 2.2).
// Every upload gets a new key, so a stored file is never overwritten (D-015).

export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

const RANDOM_BYTES = 8;

const IMAGE_EXTENSIONS: Record<ImageContentType, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// 16 random hex characters.
function randomName(): string {
  return randomBytes(RANDOM_BYTES).toString("hex");
}

export function imageExtension(type: ImageContentType): "jpg" | "png" | "webp" {
  return IMAGE_EXTENSIONS[type];
}

export function themeZipPrefix(themeId: string): string {
  return `theme-zips/${themeId}/`;
}

export function newThemeZipKey(themeId: string): string {
  return `${themeZipPrefix(themeId)}${randomName()}.zip`;
}

export function themeImagePrefix(themeId: string): string {
  return `theme-images/${themeId}/`;
}

export function newThemeImageKey(themeId: string, type: ImageContentType): string {
  return `${themeImagePrefix(themeId)}${randomName()}.${imageExtension(type)}`;
}

export function walletProofPrefix(walletPaymentId: string): string {
  return `wallet-proofs/${walletPaymentId}/`;
}

export function newWalletProofKey(walletPaymentId: string, type: ImageContentType): string {
  return `${walletProofPrefix(walletPaymentId)}${randomName()}.${imageExtension(type)}`;
}
