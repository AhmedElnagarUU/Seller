import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { ThemeModel } from "@/features/themes/theme.model";
import {
  createTheme,
  getHomePageData,
  getPublishedThemeBySlug,
  getThemeForAdmin,
  listPublishedThemes,
  listThemesForAdmin,
  setLatestVersion,
  updateTheme,
} from "@/features/themes/theme.service";
import type { ThemeInput } from "@/features/themes/theme.schemas";
import { setTestNow } from "@/shared/lib/clock";
import { createCategory, createTheme as createThemeRow } from "@/shared/test/factories";

async function buildInput(overrides: Partial<ThemeInput> = {}): Promise<ThemeInput> {
  const category = await createCategory();
  return {
    name: "Aurora Blog",
    slug: "aurora-blog",
    tagline: "A calm theme for writers",
    description: "A longer description of this theme. It has more than fifty characters in it.",
    features: ["Dark mode"],
    categoryId: category._id.toString(),
    priceCents: 2900,
    demoUrl: null,
    wordpressMin: "6.4",
    phpMin: "8.1",
    testedUpTo: "6.8",
    featured: false,
    ...overrides,
  };
}

function namesOf(items: { name: string }[]): string[] {
  return items.map((item) => item.name);
}

describe("createTheme", () => {
  it("saves a draft with price in cents", async () => {
    const input = await buildInput();

    const { id } = await createTheme(input);

    const saved = await ThemeModel.findById(id).lean();
    expect(saved?.name).toBe("Aurora Blog");
    expect(saved?.priceCents).toBe(2900);
    expect(saved?.status).toBe("draft");
    expect(saved?.images).toEqual([]);
    expect(saved?.latestVersion).toBeNull();
    expect(saved?.publishedAt).toBeNull();
    expect(saved?.stats).toEqual({ salesCount: 0, downloadCount: 0 });
    expect(saved?.provider).toEqual({ productId: null, syncedAt: null });
    expect(saved?.requirements).toEqual({ wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" });
  });

  it("refuses an unknown category", async () => {
    const input = await buildInput({ categoryId: "665f1c2e8f1b2c3d4e5f6a7b" });

    await expect(createTheme(input)).rejects.toMatchObject({
      code: "INVALID",
      message: "Choose a category.",
    });

    expect(await ThemeModel.countDocuments()).toBe(0);
  });

  it("refuses a used slug", async () => {
    await createThemeRow({ slug: "aurora-blog" });
    const input = await buildInput();

    await expect(createTheme(input)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This slug is already used.",
    });

    expect(await ThemeModel.countDocuments()).toBe(1);
  });
});

describe("updateTheme", () => {
  it("refuses a slug change after first publish", async () => {
    const theme = await createThemeRow({ slug: "aurora-blog", status: "published" });
    const input = await buildInput({ slug: "aurora-new", categoryId: theme.categoryId.toString() });

    await expect(updateTheme(theme._id.toString(), input)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "The slug cannot change after the theme was published.",
    });

    const saved = await ThemeModel.findById(theme._id).lean();
    expect(saved?.slug).toBe("aurora-blog");
  });

  it("allows a slug change on a never-published draft", async () => {
    const theme = await createThemeRow({ slug: "aurora-blog" });
    const input = await buildInput({ slug: "aurora-new", categoryId: theme.categoryId.toString() });

    await updateTheme(theme._id.toString(), input);

    const saved = await ThemeModel.findById(theme._id).lean();
    expect(saved?.slug).toBe("aurora-new");
    expect(saved?.name).toBe("Aurora Blog");
  });

  it("does not change status, stats or images", async () => {
    const theme = await createThemeRow({
      status: "published",
      stats: { salesCount: 7, downloadCount: 9 },
      images: [{ key: "themes/a/cover.webp", alt: "", width: 800, height: 600 }],
    });
    const input = await buildInput({ slug: theme.slug, categoryId: theme.categoryId.toString(), priceCents: 4900 });

    await updateTheme(theme._id.toString(), input);

    const saved = await ThemeModel.findById(theme._id).lean();
    expect(saved?.priceCents).toBe(4900);
    expect(saved?.status).toBe("published");
    expect(saved?.stats).toEqual({ salesCount: 7, downloadCount: 9 });
    expect(saved?.images).toEqual([{ key: "themes/a/cover.webp", alt: "", width: 800, height: 600 }]);
  });

  it("refuses an unknown theme", async () => {
    const input = await buildInput();

    await expect(updateTheme("665f1c2e8f1b2c3d4e5f6a7b", input)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Theme not found.",
    });
  });
});

describe("listPublishedThemes", () => {
  it("returns only published themes", async () => {
    await createThemeRow({ name: "Published One", status: "published" });
    await createThemeRow({ name: "Draft One", status: "draft" });
    await createThemeRow({ name: "Unpublished One", status: "unpublished" });

    const result = await listPublishedThemes({});

    expect(namesOf(result.items)).toEqual(["Published One"]);
    expect(result.total).toBe(1);
  });

  it("searches name and tagline case-insensitively and treats regex characters as text", async () => {
    await createThemeRow({ name: "C++ Docs", tagline: "Documentation made simple", status: "published" });
    await createThemeRow({ name: "Plain Blog", tagline: "Writes about Gardening daily", status: "published" });
    await createThemeRow({ name: "Shop Pro", tagline: "A store for everything", status: "published" });

    const byName = await listPublishedThemes({ q: "  c++ " });
    const byTagline = await listPublishedThemes({ q: "GARDENING" });
    const byRegex = await listPublishedThemes({ q: ".*" });

    expect(namesOf(byName.items)).toEqual(["C++ Docs"]);
    expect(namesOf(byTagline.items)).toEqual(["Plain Blog"]);
    expect(byRegex.items).toEqual([]);
  });

  it("filters by category slug and ignores an unknown slug", async () => {
    const blog = await createCategory({ name: "Blog", slug: "blog" });
    const shop = await createCategory({ name: "Shop", slug: "shop" });
    await createThemeRow({ name: "Blog Theme", categoryId: blog._id, status: "published" });
    await createThemeRow({ name: "Shop Theme", categoryId: shop._id, status: "published" });

    const inBlog = await listPublishedThemes({ categorySlug: "blog" });
    const unknown = await listPublishedThemes({ categorySlug: "does-not-exist" });

    expect(namesOf(inBlog.items)).toEqual(["Blog Theme"]);
    expect(inBlog.items[0]?.categoryName).toBe("Blog");
    expect(unknown.total).toBe(2);
  });

  it("sorts by price ascending and by best selling", async () => {
    await createThemeRow({
      name: "Middle",
      priceCents: 5000,
      stats: { salesCount: 1, downloadCount: 0 },
      status: "published",
    });
    await createThemeRow({
      name: "Cheap",
      priceCents: 1900,
      stats: { salesCount: 0, downloadCount: 0 },
      status: "published",
    });
    await createThemeRow({
      name: "Pricey",
      priceCents: 9900,
      stats: { salesCount: 8, downloadCount: 0 },
      status: "published",
    });

    const cheapestFirst = await listPublishedThemes({ sort: "price-asc" });
    const dearestFirst = await listPublishedThemes({ sort: "price-desc" });
    const bestFirst = await listPublishedThemes({ sort: "best" });

    expect(namesOf(cheapestFirst.items)).toEqual(["Cheap", "Middle", "Pricey"]);
    expect(namesOf(dearestFirst.items)).toEqual(["Pricey", "Middle", "Cheap"]);
    expect(namesOf(bestFirst.items)).toEqual(["Pricey", "Middle", "Cheap"]);
  });

  it("sorts the newest published theme first", async () => {
    setTestNow(new Date("2026-01-01T10:00:00Z"));
    await createThemeRow({ name: "Old", status: "published" });
    setTestNow(new Date("2026-02-01T10:00:00Z"));
    await createThemeRow({ name: "New", status: "published" });

    const result = await listPublishedThemes({ sort: "newest" });

    expect(namesOf(result.items)).toEqual(["New", "Old"]);
  });

  it("paginates 20 per page", async () => {
    const category = await createCategory();
    for (let index = 0; index < 25; index += 1) {
      await createThemeRow({ categoryId: category._id, status: "published" });
    }

    const first = await listPublishedThemes({ page: 1 });
    const second = await listPublishedThemes({ page: 2 });
    const beyond = await listPublishedThemes({ page: 3 });

    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(5);
    expect(first.totalPages).toBe(2);
    expect(first.total).toBe(25);
    expect(beyond.items).toEqual([]);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(25);
  });
});

describe("getPublishedThemeBySlug", () => {
  it("returns null for draft and unpublished themes", async () => {
    await createThemeRow({ slug: "draft-theme", status: "draft" });
    await createThemeRow({ slug: "old-theme", status: "unpublished" });

    expect(await getPublishedThemeBySlug("draft-theme")).toBeNull();
    expect(await getPublishedThemeBySlug("old-theme")).toBeNull();
    expect(await getPublishedThemeBySlug("missing")).toBeNull();
  });

  it("returns the details of a published theme", async () => {
    const category = await createCategory({ name: "Blog", slug: "blog" });
    await createThemeRow({
      slug: "aurora-blog",
      name: "Aurora Blog",
      categoryId: category._id,
      status: "published",
      features: ["Dark mode"],
    });

    const theme = await getPublishedThemeBySlug("aurora-blog");

    expect(theme?.name).toBe("Aurora Blog");
    expect(theme?.category).toEqual({ name: "Blog", slug: "blog" });
    expect(theme?.features).toEqual(["Dark mode"]);
    expect(theme?.requirements).toEqual({ wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" });
  });
});

describe("getHomePageData", () => {
  it("returns at most 6 featured, best sellers and newest", async () => {
    const category = await createCategory({ name: "Blog", slug: "blog" });
    for (let index = 0; index < 8; index += 1) {
      await createThemeRow({ categoryId: category._id, status: "published", featured: true });
    }
    await createThemeRow({ categoryId: category._id, status: "draft", featured: true });

    const home = await getHomePageData();

    expect(home.featured).toHaveLength(6);
    expect(home.bestSellers).toHaveLength(6);
    expect(home.newest).toHaveLength(6);
    expect(home.categories).toEqual([{ name: "Blog", slug: "blog", themeCount: 8 }]);
  });

  it("puts only featured themes in the featured section", async () => {
    await createThemeRow({ name: "Plain", status: "published", featured: false });
    await createThemeRow({ name: "Star", status: "published", featured: true });

    const home = await getHomePageData();

    expect(namesOf(home.featured)).toEqual(["Star"]);
    expect(home.newest).toHaveLength(2);
  });
});

describe("listThemesForAdmin", () => {
  it("shows every status, newest created first, and filters by status and name", async () => {
    setTestNow(new Date("2026-01-01T10:00:00Z"));
    await createThemeRow({ name: "Alpha Draft", status: "draft" });
    await createThemeRow({ name: "Beta Live", status: "published" });
    await createThemeRow({ name: "Gamma Old", status: "unpublished" });

    const all = await listThemesForAdmin({});
    const drafts = await listThemesForAdmin({ status: "draft" });
    const byName = await listThemesForAdmin({ q: "beta" });

    expect(all.total).toBe(3);
    expect(namesOf(all.items).sort()).toEqual(["Alpha Draft", "Beta Live", "Gamma Old"]);
    expect(namesOf(drafts.items)).toEqual(["Alpha Draft"]);
    expect(namesOf(byName.items)).toEqual(["Beta Live"]);
  });

  it("paginates 20 per page", async () => {
    const category = await createCategory();
    for (let index = 0; index < 21; index += 1) {
      await createThemeRow({ categoryId: category._id });
    }

    const second = await listThemesForAdmin({ page: 2 });

    expect(second.items).toHaveLength(1);
    expect(second.totalPages).toBe(2);
  });
});

describe("getThemeForAdmin", () => {
  it("returns the editable fields of a draft, or null when missing", async () => {
    const category = await createCategory();
    const theme = await createThemeRow({
      categoryId: category._id,
      name: "Draft Theme",
      priceCents: 4900,
      featured: true,
    });

    const found = await getThemeForAdmin(theme._id.toString());

    expect(found?.name).toBe("Draft Theme");
    expect(found?.status).toBe("draft");
    expect(found?.priceCents).toBe(4900);
    expect(found?.categoryId).toBe(category._id.toString());
    expect(found?.featured).toBe(true);
    expect(found?.publishedAt).toBeNull();
    expect(await getThemeForAdmin("665f1c2e8f1b2c3d4e5f6a7b")).toBeNull();
    expect(await getThemeForAdmin("not-an-id")).toBeNull();
  });
});

describe("setLatestVersion", () => {
  it("writes only latestVersion", async () => {
    const theme = await createThemeRow({
      status: "published",
      images: [{ key: "theme-images/seeded/1.png", alt: "Alt", width: 800, height: 600 }],
      stats: { salesCount: 3, downloadCount: 7 },
    });
    const versionId = new Types.ObjectId();
    const releasedAt = new Date("2026-03-01T10:00:00Z");

    await setLatestVersion(theme._id.toString(), { versionId: versionId.toString(), version: "1.2.0", releasedAt });

    const saved = await ThemeModel.findById(theme._id).lean();
    expect(saved?.latestVersion?.versionId.toString()).toBe(versionId.toString());
    expect(saved?.latestVersion?.version).toBe("1.2.0");
    expect(saved?.latestVersion?.releasedAt).toEqual(releasedAt);
    expect(saved?.status).toBe("published");
    expect(saved?.stats).toEqual({ salesCount: 3, downloadCount: 7 });
    expect(saved?.images).toEqual(theme.images);

    await expect(
      setLatestVersion("665f1c2e8f1b2c3d4e5f6a7b", { versionId: versionId.toString(), version: "1.2.0", releasedAt }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Theme not found." });
  });
});
