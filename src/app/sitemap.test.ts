import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { createCategory, createTheme } from "@/shared/test/factories";

describe("sitemap", () => {
  it("lists the pages, categories and published themes with absolute URLs", async () => {
    const category = await createCategory({ slug: "blog-themes" });
    const published = await createTheme({ status: "published", slug: "aurora", categoryId: category._id });
    const draft = await createTheme({ status: "draft", slug: "secret-draft", categoryId: category._id });

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual([
      "http://localhost:3000/",
      "http://localhost:3000/themes",
      "http://localhost:3000/categories/blog-themes",
      `http://localhost:3000/themes/${published.slug}`,
      "http://localhost:3000/about",
      "http://localhost:3000/terms",
      "http://localhost:3000/privacy",
      "http://localhost:3000/refund-policy",
      "http://localhost:3000/license",
      "http://localhost:3000/contact",
    ]);
    expect(urls).not.toContain(`http://localhost:3000/themes/${draft.slug}`);
    expect(entries.every((entry) => Object.keys(entry).join() === "url")).toBe(true);
  });
});
