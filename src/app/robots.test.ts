import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";

describe("robots", () => {
  it("disallows the private areas and names the sitemap", () => {
    const result = robots();

    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/admin", "/checkout", "/api"],
    });
    expect(result.sitemap).toBe("http://localhost:3000/sitemap.xml");
  });
});

describe("robots on staging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("disallows everything on staging and has no sitemap", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.resetModules();
    const { default: stagingRobots } = await import("@/app/robots");

    const result = stagingRobots();

    expect(result.rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(result.sitemap).toBeUndefined();
  });
});
