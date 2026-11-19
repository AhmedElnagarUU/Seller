import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { FavoriteModel } from "@/features/favorites/favorite.model";
import {
  favoriteTheme,
  followCategory,
  isCategoryFollowed,
  isThemeFavorite,
  listFavoriteRowsAfter,
  listFavorites,
  unfavoriteTheme,
  unfollowCategory,
} from "@/features/favorites/favorite.service";
import { CategoryModel } from "@/features/categories/category.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { createCategory, createFavorite, createTheme, createUser } from "@/shared/test/factories";

describe("listFavoriteRowsAfter", () => {
  it("filters by target type and id, _id ascending, after the cursor", async () => {
    const theme = await createTheme({ status: "published" });
    const otherTheme = await createTheme({ status: "published" });
    const category = await createCategory();
    const themeId = theme._id.toString();
    const first = await createUser();
    const second = await createUser();
    const third = await createUser();
    const firstRow = await createFavorite(first._id.toString(), "theme", themeId);
    await createFavorite(first._id.toString(), "theme", otherTheme._id.toString());
    await createFavorite(first._id.toString(), "category", category._id.toString());
    const secondRow = await createFavorite(second._id.toString(), "theme", themeId);
    const thirdRow = await createFavorite(third._id.toString(), "theme", themeId);
    // A category with the same id as the theme must not match a theme row.
    await createFavorite(third._id.toString(), "category", themeId);

    const all = await listFavoriteRowsAfter({ targetType: "theme", targetId: themeId, afterId: null, limit: 10 });
    const afterFirst = await listFavoriteRowsAfter({
      targetType: "theme",
      targetId: themeId,
      afterId: firstRow._id.toString(),
      limit: 10,
    });
    const limited = await listFavoriteRowsAfter({ targetType: "theme", targetId: themeId, afterId: null, limit: 2 });
    const categoryRows = await listFavoriteRowsAfter({
      targetType: "category",
      targetId: category._id.toString(),
      afterId: null,
      limit: 10,
    });

    expect(all).toEqual([
      { rowId: firstRow._id.toString(), userId: first._id.toString() },
      { rowId: secondRow._id.toString(), userId: second._id.toString() },
      { rowId: thirdRow._id.toString(), userId: third._id.toString() },
    ]);
    expect(afterFirst.map((row) => row.rowId)).toEqual([secondRow._id.toString(), thirdRow._id.toString()]);
    expect(limited.map((row) => row.rowId)).toEqual([firstRow._id.toString(), secondRow._id.toString()]);
    expect(categoryRows).toHaveLength(1);
    expect(categoryRows[0]?.userId).toBe(first._id.toString());
  });

  it("returns no rows for an invalid or unknown target id", async () => {
    expect(await listFavoriteRowsAfter({ targetType: "theme", targetId: "x", afterId: null, limit: 10 })).toEqual([]);
    expect(
      await listFavoriteRowsAfter({
        targetType: "theme",
        targetId: new Types.ObjectId().toString(),
        afterId: null,
        limit: 10,
      }),
    ).toEqual([]);
  });
});

const THEME_ERROR = { code: "NOT_FOUND", message: "This theme is not available." };
const CATEGORY_ERROR = { code: "NOT_FOUND", message: "Category not found." };

describe("favoriteTheme", () => {
  it("saves a favorite for a published theme", async () => {
    const user = await createUser();
    const theme = await createTheme({ status: "published" });

    await favoriteTheme(user._id.toString(), theme._id.toString());

    const rows = await FavoriteModel.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId.toString()).toBe(user._id.toString());
    expect(rows[0]?.targetType).toBe("theme");
    expect(rows[0]?.targetId.toString()).toBe(theme._id.toString());
  });

  it("does nothing when the theme is already favorited", async () => {
    const user = await createUser();
    const theme = await createTheme({ status: "published" });
    await favoriteTheme(user._id.toString(), theme._id.toString());

    await expect(favoriteTheme(user._id.toString(), theme._id.toString())).resolves.toBeUndefined();

    expect(await FavoriteModel.countDocuments()).toBe(1);
  });

  it("refuses a draft theme", async () => {
    const user = await createUser();
    const theme = await createTheme({ status: "draft" });

    await expect(favoriteTheme(user._id.toString(), theme._id.toString())).rejects.toMatchObject(THEME_ERROR);

    expect(await FavoriteModel.countDocuments()).toBe(0);
  });

  it("refuses an unpublished theme", async () => {
    const user = await createUser();
    const theme = await createTheme({ status: "unpublished" });

    await expect(favoriteTheme(user._id.toString(), theme._id.toString())).rejects.toMatchObject(THEME_ERROR);

    expect(await FavoriteModel.countDocuments()).toBe(0);
  });

  it("refuses an unknown or invalid theme id", async () => {
    const user = await createUser();

    await expect(favoriteTheme(user._id.toString(), new Types.ObjectId().toString())).rejects.toMatchObject(
      THEME_ERROR,
    );
    await expect(favoriteTheme(user._id.toString(), "not-an-id")).rejects.toMatchObject(THEME_ERROR);

    expect(await FavoriteModel.countDocuments()).toBe(0);
  });
});

describe("unfavoriteTheme", () => {
  it("removes the row and leaves other users' rows", async () => {
    const userA = await createUser();
    const userB = await createUser();
    const theme = await createTheme({ status: "published" });
    await createFavorite(userA._id.toString(), "theme", theme._id.toString());
    await createFavorite(userB._id.toString(), "theme", theme._id.toString());

    await unfavoriteTheme(userA._id.toString(), theme._id.toString());

    const rows = await FavoriteModel.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId.toString()).toBe(userB._id.toString());
  });

  it("does nothing when the theme was not favorited", async () => {
    const userA = await createUser();
    const userB = await createUser();
    const theme = await createTheme({ status: "published" });
    await createFavorite(userB._id.toString(), "theme", theme._id.toString());

    await expect(unfavoriteTheme(userA._id.toString(), theme._id.toString())).resolves.toBeUndefined();

    expect(await FavoriteModel.countDocuments()).toBe(1);
  });

  it("still removes the favorite of a theme that was unpublished later", async () => {
    const user = await createUser();
    const theme = await createTheme({ status: "published" });
    await createFavorite(user._id.toString(), "theme", theme._id.toString());
    await ThemeModel.updateOne({ _id: theme._id }, { $set: { status: "unpublished" } });

    await unfavoriteTheme(user._id.toString(), theme._id.toString());

    expect(await FavoriteModel.countDocuments()).toBe(0);
  });
});

describe("followCategory", () => {
  it("saves a follow for an existing category", async () => {
    const user = await createUser();
    const category = await createCategory();

    await followCategory(user._id.toString(), category._id.toString());

    const rows = await FavoriteModel.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId.toString()).toBe(user._id.toString());
    expect(rows[0]?.targetType).toBe("category");
    expect(rows[0]?.targetId.toString()).toBe(category._id.toString());
  });

  it("following twice keeps 1 row", async () => {
    const user = await createUser();
    const category = await createCategory();

    await followCategory(user._id.toString(), category._id.toString());
    await followCategory(user._id.toString(), category._id.toString());

    expect(await FavoriteModel.countDocuments()).toBe(1);
  });

  it("refuses an unknown category", async () => {
    const user = await createUser();

    await expect(followCategory(user._id.toString(), new Types.ObjectId().toString())).rejects.toMatchObject(
      CATEGORY_ERROR,
    );

    expect(await FavoriteModel.countDocuments()).toBe(0);
  });
});

describe("unfollowCategory", () => {
  it("removes only that category's row", async () => {
    const user = await createUser();
    const first = await createCategory();
    const second = await createCategory();
    await createFavorite(user._id.toString(), "category", first._id.toString());
    await createFavorite(user._id.toString(), "category", second._id.toString());

    await unfollowCategory(user._id.toString(), first._id.toString());

    const rows = await FavoriteModel.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetId.toString()).toBe(second._id.toString());
  });
});

describe("listFavorites", () => {
  it("returns only the user's published favorite themes, most recently added first", async () => {
    const user = await createUser();
    const other = await createUser();
    const themeA = await createTheme({ status: "published" });
    const themeB = await createTheme({ status: "published" });
    const hidden = await createTheme({ status: "published" });
    const otherTheme = await createTheme({ status: "published" });
    await createFavorite(user._id.toString(), "theme", themeA._id.toString());
    await createFavorite(user._id.toString(), "theme", hidden._id.toString());
    await createFavorite(user._id.toString(), "theme", themeB._id.toString());
    await createFavorite(other._id.toString(), "theme", otherTheme._id.toString());
    await ThemeModel.updateOne({ _id: hidden._id }, { $set: { status: "unpublished" } });

    const favorites = await listFavorites(user._id.toString());

    expect(favorites.themes.map((theme) => theme.id)).toEqual([themeB._id.toString(), themeA._id.toString()]);
    expect(favorites.categories).toEqual([]);
    expect(await FavoriteModel.countDocuments({ targetId: hidden._id })).toBe(1);
  });

  it("returns followed categories as { id, name, slug }, skipping a category whose document was removed directly from the database", async () => {
    const user = await createUser();
    const blog = await createCategory({ name: "Blog", slug: "blog" });
    const removed = await createCategory({ name: "Gone", slug: "gone" });
    const shop = await createCategory({ name: "Shop", slug: "shop" });
    await createFavorite(user._id.toString(), "category", blog._id.toString());
    await createFavorite(user._id.toString(), "category", removed._id.toString());
    await createFavorite(user._id.toString(), "category", shop._id.toString());
    await CategoryModel.deleteOne({ _id: removed._id });

    const favorites = await listFavorites(user._id.toString());

    expect(favorites.categories).toEqual([
      { id: shop._id.toString(), name: "Shop", slug: "shop" },
      { id: blog._id.toString(), name: "Blog", slug: "blog" },
    ]);
    expect(favorites.themes).toEqual([]);
  });
});

describe("isThemeFavorite / isCategoryFollowed", () => {
  it("are true only for the user who saved the row", async () => {
    const user = await createUser();
    const other = await createUser();
    const theme = await createTheme({ status: "published" });
    const otherTheme = await createTheme({ status: "published" });
    const category = await createCategory();
    const otherCategory = await createCategory();
    await createFavorite(user._id.toString(), "theme", theme._id.toString());
    await createFavorite(user._id.toString(), "category", category._id.toString());

    expect(await isThemeFavorite(user._id.toString(), theme._id.toString())).toBe(true);
    expect(await isThemeFavorite(other._id.toString(), theme._id.toString())).toBe(false);
    expect(await isThemeFavorite(user._id.toString(), otherTheme._id.toString())).toBe(false);
    expect(await isCategoryFollowed(user._id.toString(), category._id.toString())).toBe(true);
    expect(await isCategoryFollowed(other._id.toString(), category._id.toString())).toBe(false);
    expect(await isCategoryFollowed(user._id.toString(), otherCategory._id.toString())).toBe(false);
  });
});

describe("favorites index", () => {
  it("the database refuses the same favorite twice", async () => {
    await FavoriteModel.init();
    const user = await createUser();
    const theme = await createTheme({ status: "published" });
    const row = { userId: user._id, targetType: "theme" as const, targetId: theme._id };
    await FavoriteModel.create(row);

    await expect(FavoriteModel.create(row)).rejects.toMatchObject({ code: 11000 });

    expect(await FavoriteModel.countDocuments()).toBe(1);
  });
});
