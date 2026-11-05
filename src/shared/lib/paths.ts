// Returns `value` when it is a safe internal path ("/..." but not "//..."), otherwise "/".
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
