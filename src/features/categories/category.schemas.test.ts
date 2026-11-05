import { describe, expect, it } from "vitest";
import { categoryInputSchema } from "@/features/categories/category.schemas";

const VALID_INPUT = { name: "Blog", slug: "blog", description: "", sortOrder: "0" };

describe("categoryInputSchema", () => {
  it("refuses Blog Themes as slug", () => {
    const result = categoryInputSchema.safeParse({ ...VALID_INPUT, slug: "Blog Themes" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(["Use lowercase letters, numbers and dashes."]);
    expect(result.error?.issues[0]?.path).toEqual(["slug"]);
  });

  it("turns an empty description into null and reads the sort order as a number", () => {
    const result = categoryInputSchema.safeParse({ ...VALID_INPUT, sortOrder: "-3" });

    expect(result.data).toEqual({ name: "Blog", slug: "blog", description: null, sortOrder: -3 });
  });

  it("refuses a sort order that is not a whole number", () => {
    const result = categoryInputSchema.safeParse({ ...VALID_INPUT, sortOrder: "1.5" });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual(["Enter a whole number."]);
  });
});
