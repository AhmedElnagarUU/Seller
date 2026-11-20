type AppEnv = "local" | "ci" | "staging" | "production";
type Header = { key: string; value: string };

const ONE_YEAR_SECONDS = 31_536_000;

// Browser security headers sent with every page (D-151). HSTS only where the site is served over HTTPS.
export function securityHeaders(appEnv: AppEnv): Header[] {
  const headers: Header[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // No other site may show these pages in a frame (clickjacking). Our own preview page frames the theme's demo
    // site, which is allowed: this header only limits who frames us.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ];
  if (appEnv === "staging" || appEnv === "production") {
    headers.push({ key: "Strict-Transport-Security", value: `max-age=${ONE_YEAR_SECONDS}` });
  }
  return headers;
}
