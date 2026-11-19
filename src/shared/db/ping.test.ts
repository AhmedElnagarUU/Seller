import { describe, expect, it } from "vitest";
import { pingDatabase } from "@/shared/db/ping";

describe("pingDatabase", () => {
  it("is true when the database answers", async () => {
    expect(await pingDatabase(5000)).toBe(true);
  });

  it("is false after a timeout", async () => {
    const result = await pingDatabase(0);

    expect(result).toBe(false);
  });
});
