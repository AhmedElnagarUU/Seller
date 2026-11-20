// The client IP for the auth limits (D-150): `cf-connecting-ip` (Cloudflare, D-146), then the first
// `x-forwarded-for` entry, else "unknown". Never log the result.
export function readClientIp(headers: Headers): string {
  const cloudflareIp = headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;
  const forwardedIp = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedIp) return forwardedIp;
  return "unknown";
}
