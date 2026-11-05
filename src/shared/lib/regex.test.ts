import { describe, expect, it } from "vitest";
import { escapeRegex } from "@/shared/lib/regex";

describe("escapeRegex", () => {
  it("makes regex characters match themselves", () => {
    const pattern = new RegExp(escapeRegex("c++ (a.b)[1]"));

    expect(escapeRegex("c++")).toBe("c\\+\\+");
    expect(pattern.test("learn c++ (a.b)[1] now")).toBe(true);
    expect(pattern.test("c++ (aXb)[1]")).toBe(false);
  });
});
