import { describe, expect, it } from "vitest";
import { favoriteTargetSchema } from "@/features/favorites/favorite.schemas";

describe("favoriteTargetSchema", () => {
  it("accepts a 24-character hex id and refuses 'abc' with 'Not found.'", () => {
    const valid = favoriteTargetSchema.safeParse({ targetId: "665f1c2e8f1b2c3d4e5f6a7b" });
    const invalid = favoriteTargetSchema.safeParse({ targetId: "abc" });

    expect(valid.success).toBe(true);
    expect(valid.success && valid.data.targetId).toBe("665f1c2e8f1b2c3d4e5f6a7b");
    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues.map((issue) => issue.message)).toEqual(["Not found."]);
  });
});
