import { describe, expect, it } from "vitest";
import { getInfoPage } from "@/features/content/content.service";

describe("getInfoPage", () => {
  it("returns title and markdown of each of the 5 pages", async () => {
    const expected = [
      ["about", "About"],
      ["terms", "Terms of Service"],
      ["privacy", "Privacy Policy"],
      ["refund-policy", "Refund Policy"],
      ["license", "License"],
    ] as const;

    for (const [slug, title] of expected) {
      const page = await getInfoPage(slug);
      expect(page?.slug).toBe(slug);
      expect(page?.title).toBe(title);
      expect(page?.markdown.trim().length).toBeGreaterThan(0);
    }
  });

  it("returns null for an unknown slug and never reads outside the content folder", async () => {
    expect(await getInfoPage("nope")).toBeNull();
    expect(await getInfoPage("../../package")).toBeNull();
  });
});
