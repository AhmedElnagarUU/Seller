import { describe, expect, it } from "vitest";
import { parseObjectId, toObjectId } from "@/shared/db/ids";

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

describe("parseObjectId", () => {
  it("returns null for an invalid id and the ObjectId for a valid one", () => {
    const validId = "507f1f77bcf86cd799439011";

    expect(parseObjectId("not-an-id")).toBeNull();
    expect(parseObjectId("abcdefghijkl")).toBeNull();
    expect(parseObjectId(validId)?.toString()).toBe(validId);
  });
});
