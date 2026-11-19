import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { listFavoriteRowsAfter } from "@/features/favorites/favorite.service";
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
