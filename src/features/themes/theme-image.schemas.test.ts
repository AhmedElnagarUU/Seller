import { describe, expect, it } from "vitest";
import { z } from "zod";
import { addThemeImageSchema } from "@/features/themes/theme-image.schemas";

const PIXELS_MESSAGE = "Images must be 400 to 6000 pixels wide and high.";
const VALID_INPUT = {
  themeId: "665f1c2e8f1b2c3d4e5f6a7b",
  key: "theme-images/665f1c2e8f1b2c3d4e5f6a7b/0123456789abcdef.png",
  alt: "Hero",
  width: 1200,
  height: 800,
};

function fieldErrorsOf(input: Record<string, unknown>): Record<string, string[] | undefined> {
  const result = addThemeImageSchema.safeParse(input);
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
}

describe("addThemeImageSchema", () => {
  it("accepts 400 and 6000 and refuses 399 and 6001 pixels", () => {
    expect(addThemeImageSchema.safeParse({ ...VALID_INPUT, width: 400, height: 6000 }).success).toBe(true);
    expect(addThemeImageSchema.safeParse({ ...VALID_INPUT, width: 6000, height: 400 }).success).toBe(true);

    expect(fieldErrorsOf({ ...VALID_INPUT, width: 399 })).toEqual({ width: [PIXELS_MESSAGE] });
    expect(fieldErrorsOf({ ...VALID_INPUT, width: 6001 })).toEqual({ width: [PIXELS_MESSAGE] });
    expect(fieldErrorsOf({ ...VALID_INPUT, height: 399 })).toEqual({ height: [PIXELS_MESSAGE] });
    expect(fieldErrorsOf({ ...VALID_INPUT, height: 6001 })).toEqual({ height: [PIXELS_MESSAGE] });
  });

  it("refuses a decimal width such as `800.5`", () => {
    expect(fieldErrorsOf({ ...VALID_INPUT, width: 800.5 })).toEqual({ width: [PIXELS_MESSAGE] });
  });

  it('refuses an alt text of 151 characters with `"Use up to 150 characters."` on `alt` and accepts exactly 150 characters', () => {
    expect(fieldErrorsOf({ ...VALID_INPUT, alt: "a".repeat(151) })).toEqual({ alt: ["Use up to 150 characters."] });

    const parsed = addThemeImageSchema.safeParse({ ...VALID_INPUT, alt: "a".repeat(150) });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.alt).toHaveLength(150);
  });
});
