import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import {
  toThemeAdminDTO,
  toThemeAdminListItemDTO,
  toThemeCardDTO,
  toThemeDetailDTO,
} from "@/features/themes/theme.mapper";
import { createTheme } from "@/shared/test/factories";

describe("toThemeCardDTO", () => {
  it("builds the cover URL from PUBLIC_IMAGES_BASE_URL and the first image key", async () => {
    const theme = await createTheme({
      images: [
        { key: "themes/aurora/cover.webp", alt: "Cover", width: 1200, height: 900 },
        { key: "themes/aurora/second.webp", alt: "Second", width: 800, height: 600 },
      ],
    });

    const card = toThemeCardDTO(theme, "Blog");

    expect(card.coverImage).toEqual({
      url: "http://localhost:9000/store-images/themes/aurora/cover.webp",
      alt: "Cover",
      width: 1200,
      height: 900,
    });
    expect(card.categoryName).toBe("Blog");
    expect(card.latestVersion).toBeNull();
  });

  it("has no cover image for a theme without images", async () => {
    const theme = await createTheme();

    expect(toThemeCardDTO(theme, "Blog").coverImage).toBeNull();
  });
});

describe("toThemeDetailDTO", () => {
  it("adds the details, image URLs and the version release date", async () => {
    const releasedAt = new Date("2026-03-01T00:00:00Z");
    const theme = await createTheme({
      features: ["Dark mode"],
      demoUrl: "https://demo.example.com/aurora",
      images: [{ key: "themes/aurora/cover.webp", alt: "Cover", width: 1200, height: 900 }],
      latestVersion: { versionId: new Types.ObjectId(), version: "1.2.0", releasedAt },
    });

    const detail = toThemeDetailDTO(theme, { id: "x", name: "Blog", slug: "blog", description: null });

    expect(detail.category).toEqual({ name: "Blog", slug: "blog" });
    expect(detail.categoryName).toBe("Blog");
    expect(detail.features).toEqual(["Dark mode"]);
    expect(detail.demoUrl).toBe("https://demo.example.com/aurora");
    expect(detail.images.map((image) => image.url)).toEqual([
      "http://localhost:9000/store-images/themes/aurora/cover.webp",
    ]);
    expect(detail.requirements).toEqual({ wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" });
    expect(detail.latestVersion).toBe("1.2.0");
    expect(detail.latestVersionReleasedAt).toEqual(releasedAt);
  });
});

describe("toThemeAdminDTO and toThemeAdminListItemDTO", () => {
  it("copy the editable fields, the stats and the status", async () => {
    const theme = await createTheme({ status: "published", stats: { salesCount: 3, downloadCount: 5 } });

    const admin = toThemeAdminDTO(theme);
    const listItem = toThemeAdminListItemDTO(theme);

    expect(admin.id).toBe(theme._id.toString());
    expect(admin.categoryId).toBe(theme.categoryId.toString());
    expect(admin.status).toBe("published");
    expect(admin.publishedAt).toEqual(theme.publishedAt);
    expect(listItem.salesCount).toBe(3);
    expect(listItem.downloadCount).toBe(5);
    expect(listItem.latestVersion).toBeNull();
  });
});
