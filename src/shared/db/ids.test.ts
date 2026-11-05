import { describe, expect, it } from "vitest";
import { toObjectId } from "@/shared/db/ids";

describe("toObjectId", () => {
  it("throws NOT_FOUND for an invalid id", () => {
    expect(() => toObjectId("not-an-id")).toThrowError(
      expect.objectContaining({ code: "NOT_FOUND", message: "Not found." }),
    );
  });

  it("returns an ObjectId for a valid id", () => {
    const validId = "507f1f77bcf86cd799439011";
    expect(toObjectId(validId).toString()).toBe(validId);
  });
});
