// A made-up origin to resolve paths against. A path that leaves it is not a path of this site.
const PATH_CHECK_ORIGIN = "http://internal.invalid";

// Returns `value` when it is a safe internal path, otherwise "/". It must start with "/" and stay on this site after
// the browser reads it: "//evil.com" and "/\evil.com" both lead to another site, so they are refused.
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  if (!URL.canParse(value, PATH_CHECK_ORIGIN)) return "/";
  const url = new URL(value, PATH_CHECK_ORIGIN);
  if (url.origin !== PATH_CHECK_ORIGIN) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
