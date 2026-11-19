import { describe, expect, it } from "vitest";
import { feedbackInputSchema, feedbackSearchParamsSchema } from "@/features/feedback/feedback.schemas";

const LONG_ENOUGH = "A message of ten+";

describe("feedbackInputSchema", () => {
  it("trims the ends, keeps inner line breaks, refuses a 2-character subject and a 9-character message", () => {
    const valid = feedbackInputSchema.safeParse({ subject: "  Hello  ", message: "  Line one\nLine two  " });
    const invalid = feedbackInputSchema.safeParse({ subject: "ab", message: "123456789" });

    expect(valid.success && valid.data).toEqual({ subject: "Hello", message: "Line one\nLine two" });
    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ["subject", "Use 3 to 120 characters."],
      ["message", "Use 10 to 5 000 characters."],
    ]);
  });

  it("accepts exactly 120 / 5 000 characters and refuses 121 / 5 001", () => {
    const valid = feedbackInputSchema.safeParse({ subject: "s".repeat(120), message: "m".repeat(5000) });
    const invalid = feedbackInputSchema.safeParse({ subject: "s".repeat(121), message: "m".repeat(5001) });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ["subject", "Use 3 to 120 characters."],
      ["message", "Use 10 to 5 000 characters."],
    ]);
    expect(feedbackInputSchema.safeParse({ subject: "abc", message: LONG_ENOUGH }).success).toBe(true);
  });
});

describe("feedbackSearchParamsSchema", () => {
  it("falls back to tab new and page 1 for bad values (tab=abc, page=0)", () => {
    expect(feedbackSearchParamsSchema.parse({ tab: "abc", page: "0" })).toEqual({ tab: "new", page: 1 });
    expect(feedbackSearchParamsSchema.parse({})).toEqual({ tab: "new", page: 1 });
    expect(feedbackSearchParamsSchema.parse({ tab: "resolved", page: "3" })).toEqual({ tab: "resolved", page: 3 });
  });
});
