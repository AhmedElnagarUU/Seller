import { describe, expect, it } from "vitest";
import { CategoryModel } from "@/features/categories/category.model";
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  getCategoryBySlug,
  listCategoriesForAdmin,
  listCategoriesWithPublishedCounts,
  updateCategory,
} from "@/features/categories/category.service";
import { createAdmin, createCategory as createCategoryRow, createTheme } from "@/shared/test/factories";

const BLOG_INPUT = { name: "Blog", slug: "blog", description: null, sortOrder: 0 };

describe("createCategory", () => {
  it("saves a valid category", async () => {
    const admin = await createAdmin();

    const { id } = await createCategory(BLOG_INPUT, admin._id.toString());

    const saved = await CategoryModel.findById(id).lean();
    expect(saved?.name).toBe("Blog");
    expect(saved?.slug).toBe("blog");
    expect(saved?.description).toBeNull();
    expect(saved?.sortOrder).toBe(0);
  });

  it("refuses a name that differs only in case", async () => {
    const admin = await createAdmin();
    await createCategoryRow({ name: "Blog", slug: "blog" });

    await expect(
      createCategory({ ...BLOG_INPUT, name: "bLOG", slug: "other" }, admin._id.toString()),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A category with this name already exists.",
    });

    expect(await CategoryModel.countDocuments()).toBe(1);
  });

  it("refuses a used slug", async () => {
    const admin = await createAdmin();
    await createCategoryRow({ name: "Blog", slug: "blog" });

    await expect(createCategory({ ...BLOG_INPUT, name: "Business" }, admin._id.toString())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This slug is already used.",
    });

    expect(await CategoryModel.countDocuments()).toBe(1);
  });
});

describe("updateCategory", () => {
  it("allows keeping its own name", async () => {
    const admin = await createAdmin();
    const category = await createCategoryRow({ name: "Blog", slug: "blog" });

    await updateCategory(
      category._id.toString(),
      { ...BLOG_INPUT, description: "Themes for writers", sortOrder: 5 },
      admin._id.toString(),
    );

    const saved = await CategoryModel.findById(category._id).lean();
    expect(saved?.name).toBe("Blog");
    expect(saved?.description).toBe("Themes for writers");
    expect(saved?.sortOrder).toBe(5);
  });
});

describe("updateCategory (unknown or conflicting)", () => {
  it("refuses an unknown category", async () => {
    const admin = await createAdmin();

    await expect(updateCategory("665f1c2e8f1b2c3d4e5f6a7b", BLOG_INPUT, admin._id.toString())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Category not found.",
    });

    expect(await CategoryModel.countDocuments()).toBe(0);
  });

  it("refuses the name of another category", async () => {
    const admin = await createAdmin();
    await createCategoryRow({ name: "Blog", slug: "blog" });
    const shop = await createCategoryRow({ name: "Shop", slug: "shop" });

    await expect(
      updateCategory(shop._id.toString(), { ...BLOG_INPUT, slug: "shop" }, admin._id.toString()),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "A category with this name already exists." });

    const saved = await CategoryModel.findById(shop._id).lean();
    expect(saved?.name).toBe("Shop");
  });

  it("refuses the slug of another category", async () => {
    const admin = await createAdmin();
    await createCategoryRow({ name: "Blog", slug: "blog" });
    const shop = await createCategoryRow({ name: "Shop", slug: "shop" });

    await expect(
      updateCategory(shop._id.toString(), { ...BLOG_INPUT, name: "Shop" }, admin._id.toString()),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "This slug is already used." });

    const saved = await CategoryModel.findById(shop._id).lean();
    expect(saved?.slug).toBe("shop");
  });
});

describe("deleteCategory", () => {
  it("refuses an unknown category", async () => {
    const admin = await createAdmin();

    await expect(deleteCategory("665f1c2e8f1b2c3d4e5f6a7b", admin._id.toString())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Category not found.",
    });
  });

  it("refuses a category that has a draft theme", async () => {
    const admin = await createAdmin();
    const category = await createCategoryRow();
    await createTheme({ categoryId: category._id, status: "draft" });

    await expect(deleteCategory(category._id.toString(), admin._id.toString())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This category still has themes. Move them to another category first.",
    });

    expect(await CategoryModel.countDocuments({ _id: category._id })).toBe(1);
  });

  it("deletes an empty category", async () => {
    const admin = await createAdmin();
    const category = await createCategoryRow();

    await deleteCategory(category._id.toString(), admin._id.toString());

    expect(await CategoryModel.countDocuments()).toBe(0);
  });
});

describe("listCategoriesWithPublishedCounts", () => {
  it("counts only published themes and keeps empty categories", async () => {
    const blog = await createCategoryRow({ name: "Blog", slug: "blog", sortOrder: 1 });
    await createCategoryRow({ name: "Shop", slug: "shop", sortOrder: 2 });
    await createTheme({ categoryId: blog._id, status: "published" });
    await createTheme({ categoryId: blog._id, status: "draft" });
    await createTheme({ categoryId: blog._id, status: "unpublished" });

    const categories = await listCategoriesWithPublishedCounts();

    expect(categories).toEqual([
      { name: "Blog", slug: "blog", themeCount: 1 },
      { name: "Shop", slug: "shop", themeCount: 0 },
    ]);
  });
});

describe("listCategoriesForAdmin", () => {
  it("sorts by sort order then name and counts themes of every status", async () => {
    const blog = await createCategoryRow({ name: "Blog", slug: "blog", sortOrder: 2 });
    await createCategoryRow({ name: "Shop", slug: "shop", sortOrder: 1 });
    await createCategoryRow({ name: "Agency", slug: "agency", sortOrder: 2 });
    await createTheme({ categoryId: blog._id, status: "published" });
    await createTheme({ categoryId: blog._id, status: "draft" });

    const categories = await listCategoriesForAdmin();

    expect(categories.map((category) => [category.name, category.themeCount])).toEqual([
      ["Shop", 0],
      ["Agency", 0],
      ["Blog", 2],
    ]);
  });
});

describe("getCategoryBySlug and getCategoryById", () => {
  it("find a category and return null for a missing one", async () => {
    const blog = await createCategoryRow({ name: "Blog", slug: "blog", description: "Writers", sortOrder: 4 });

    const bySlug = await getCategoryBySlug("blog");
    const byId = await getCategoryById(blog._id.toString());

    expect(bySlug).toEqual({ id: blog._id.toString(), name: "Blog", slug: "blog", description: "Writers" });
    expect(byId?.sortOrder).toBe(4);
    expect(await getCategoryBySlug("missing")).toBeNull();
    expect(await getCategoryById("665f1c2e8f1b2c3d4e5f6a7b")).toBeNull();
  });
});
