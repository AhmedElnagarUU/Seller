import { describe, expect, it } from "vitest";
import { securityHeaders } from "@/shared/config/security-headers";

function asMap(headers: { key: string; value: string }[]): Record<string, string> {
  return Object.fromEntries(headers.map((header) => [header.key, header.value]));
}

describe("securityHeaders", () => {
  it("always forbids framing and content sniffing", () => {
    const headers = asMap(securityHeaders("local"));

    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
  });

  it("adds HSTS only on staging and production", () => {
    expect(asMap(securityHeaders("production"))["Strict-Transport-Security"]).toBe("max-age=31536000");
    expect(asMap(securityHeaders("staging"))["Strict-Transport-Security"]).toBe("max-age=31536000");
    expect(asMap(securityHeaders("local"))["Strict-Transport-Security"]).toBeUndefined();
    expect(asMap(securityHeaders("ci"))["Strict-Transport-Security"]).toBeUndefined();
  });
});
