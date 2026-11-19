import { describe, expect, it } from "vitest";
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
