const MONGO_DUPLICATE_KEY_CODE = 11000;

// True when MongoDB refused a write because of a unique index.
export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === MONGO_DUPLICATE_KEY_CODE;
}
