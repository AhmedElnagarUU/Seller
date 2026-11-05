import { describe, expect, it } from "vitest";
import { readLines } from "@/shared/lib/form-data";
import {
  adminThemeSearchParamsSchema,
  themeInputSchema,
  themeSearchParamsSchema,
} from "@/features/themes/theme.schemas";

const VALID_INPUT = {
  name: "Aurora Blog",
  slug: "aurora-blog",
  tagline: "A calm theme for writers",
  description: "A longer description of this theme. It has more than fifty characters in it.",
  features: [],
  categoryId: "665f1c2e8f1b2c3d4e5f6a7b",
  price: "29.99",
  demoUrl: "",
  wordpressMin: "6.4",
  phpMin: "8.1",
  testedUpTo: "6.8",
  featured: false,
};

function messagesOf(input: Record<string, unknown>): string[] {
  const result = themeInputSchema.safeParse(input);
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("themeInputSchema", () => {
  it("converts 29.99 to 2999 cents and refuses 0.5 and 12.345", () => {
    const valid = themeInputSchema.safeParse(VALID_INPUT);
    expect(valid.data?.priceCents).toBe(2999);
    expect(valid.data).not.toHaveProperty("price");

    const priceMessage = ["Enter a price between $1.00 and $1,000.00."];
    expect(messagesOf({ ...VALID_INPUT, price: "0.5" })).toEqual(priceMessage);
    expect(messagesOf({ ...VALID_INPUT, price: "12.345" })).toEqual(priceMessage);
    expect(messagesOf({ ...VALID_INPUT, price: "1000.01" })).toEqual(priceMessage);
    expect(messagesOf({ ...VALID_INPUT, price: "abc" })).toEqual(priceMessage);
  });

  it("turns an empty demo URL into null and refuses http://", () => {
    const empty = themeInputSchema.safeParse({ ...VALID_INPUT, demoUrl: "" });
    expect(empty.data?.demoUrl).toBeNull();

    const secure = themeInputSchema.safeParse({ ...VALID_INPUT, demoUrl: "https://demo.example.com/aurora" });
    expect(secure.data?.demoUrl).toBe("https://demo.example.com/aurora");

    expect(messagesOf({ ...VALID_INPUT, demoUrl: "http://demo.example.com" })).toEqual([
      "Enter a full https:// address.",
    ]);
  });

  it("splits features by line and drops empty lines", () => {
    const formData = new FormData();
    formData.set("features", "Dark mode\n\n  Fast loading  \r\n   \nWooCommerce ready");

    const result = themeInputSchema.safeParse({ ...VALID_INPUT, features: readLines(formData, "features") });

    expect(result.data?.features).toEqual(["Dark mode", "Fast loading", "WooCommerce ready"]);
  });

  it("refuses a feature that is too short and a bad category, slug and version", () => {
    expect(messagesOf({ ...VALID_INPUT, features: ["x"] })).toEqual([
      "Each feature needs 2 to 120 characters (max 30 features).",
    ]);
    expect(messagesOf({ ...VALID_INPUT, categoryId: "" })).toEqual(["Choose a category."]);
    expect(messagesOf({ ...VALID_INPUT, slug: "Aurora Blog" })).toEqual(["Use lowercase letters, numbers and dashes."]);
    expect(messagesOf({ ...VALID_INPUT, phpMin: "eight" })).toEqual(["Use a version like 6.4."]);
    expect(messagesOf({ ...VALID_INPUT, description: "Too short" })).toEqual(["Write at least 50 characters."]);
  });
});

describe("themeSearchParamsSchema", () => {
  it("falls back to the defaults for bad values", () => {
    const result = themeSearchParamsSchema.parse({ sort: "cheapest", page: "-2", q: ["a", "b"] });

    expect(result).toEqual({ q: "", category: "", sort: "newest", page: 1 });
  });

  it("keeps good values", () => {
    const result = themeSearchParamsSchema.parse({ q: " blog ", category: "shop", sort: "best", page: "3" });

    expect(result).toEqual({ q: "blog", category: "shop", sort: "best", page: 3 });
  });
});

describe("adminThemeSearchParamsSchema", () => {
  it("ignores an unknown status", () => {
    expect(adminThemeSearchParamsSchema.parse({ status: "archived" }).status).toBeUndefined();
    expect(adminThemeSearchParamsSchema.parse({ status: "draft" }).status).toBe("draft");
  });
});
