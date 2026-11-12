import { describe, expect, it } from "vitest";
import { downloadErrorSearchParamsSchema } from "@/features/downloads/download.schemas";

describe("downloadErrorSearchParamsSchema", () => {
  it("keeps the four known values and ignores anything else", () => {
    for (const value of ["not_found", "not_owned", "rate_limited", "failed"]) {
      expect(downloadErrorSearchParamsSchema.parse({ downloadError: value }).downloadError).toBe(value);
    }
    expect(downloadErrorSearchParamsSchema.parse({ downloadError: "constructor" }).downloadError).toBeUndefined();
    expect(downloadErrorSearchParamsSchema.parse({ downloadError: "bogus" }).downloadError).toBeUndefined();
    expect(downloadErrorSearchParamsSchema.parse({}).downloadError).toBeUndefined();
  });
});
