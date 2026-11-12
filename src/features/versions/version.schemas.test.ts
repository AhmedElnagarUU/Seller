import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createVersionSchema, versionsPageSearchParamsSchema } from "@/features/versions/version.schemas";

const VERSION_MESSAGE = "Use a version like 1.4.0.";
const COUNT_MESSAGE = "Add between 1 and 50 changes.";
const TEXT_MESSAGE = "Each change needs 2 to 200 characters.";
const VALID_INPUT = {
  themeId: "665f1c2e8f1b2c3d4e5f6a7b",
  version: "1.4.0",
  changes: [{ type: "new", text: "Added dark mode" }],
  notify: true,
  fileKey: "theme-zips/665f1c2e8f1b2c3d4e5f6a7b/0123456789abcdef.zip",
  originalName: "theme.zip",
};

function fieldErrorsOf(input: Record<string, unknown>): Record<string, string[] | undefined> {
  const result = createVersionSchema.safeParse(input);
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
}

function buildChanges(count: number, text = "Added dark mode") {
  return Array.from({ length: count }, () => ({ type: "fixed", text }));
}

describe("createVersionSchema", () => {
  it("refuses bad version numbers", () => {
    for (const version of ["1.04.0", "1.4", "v1.4.0"]) {
      expect(fieldErrorsOf({ ...VALID_INPUT, version })).toEqual({ version: [VERSION_MESSAGE] });
    }
    expect(createVersionSchema.safeParse(VALID_INPUT).success).toBe(true);
  });

  it("refuses 0 and 51 changes", () => {
    expect(fieldErrorsOf({ ...VALID_INPUT, changes: [] })).toEqual({ changes: [COUNT_MESSAGE] });
    expect(fieldErrorsOf({ ...VALID_INPUT, changes: buildChanges(51) })).toEqual({ changes: [COUNT_MESSAGE] });
    expect(createVersionSchema.safeParse({ ...VALID_INPUT, changes: buildChanges(50) }).success).toBe(true);
  });

  it("refuses a change text of 1 and of 201 characters", () => {
    expect(fieldErrorsOf({ ...VALID_INPUT, changes: buildChanges(1, "a") })).toEqual({ changes: [TEXT_MESSAGE] });
    expect(fieldErrorsOf({ ...VALID_INPUT, changes: buildChanges(1, "a".repeat(201)) })).toEqual({
      changes: [TEXT_MESSAGE],
    });

    const trimmed = createVersionSchema.parse({ ...VALID_INPUT, changes: [{ type: "fixed", text: "  Fixed bug  " }] });

    expect(trimmed.changes).toEqual([{ type: "fixed", text: "Fixed bug" }]);
  });
});

describe("versionsPageSearchParamsSchema", () => {
  it("keeps a valid released version and falls back for others", () => {
    expect(versionsPageSearchParamsSchema.parse({ released: "1.0.0", notified: "1" })).toEqual({
      released: "1.0.0",
      notified: "1",
    });
    expect(versionsPageSearchParamsSchema.parse({ released: "<script>", notified: "2" })).toEqual({
      released: undefined,
      notified: undefined,
    });
  });
});
