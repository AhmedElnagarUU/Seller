import { describe, expect, it } from "vitest";
import { formatMegabytes } from "@/shared/lib/files";

describe("formatMegabytes", () => {
  it("shows MB with 1 decimal", () => {
    expect(formatMegabytes(209715200)).toBe("200.0 MB");
    expect(formatMegabytes(1572864)).toBe("1.5 MB");
  });
});
