import { describe, expect, it } from "vitest";
import { couponInputSchema, couponUpdateSchema } from "@/features/coupons/coupon.schemas";

const THEME_ID = "665f1c2e8f1b2c3d4e5f6a7b";
const OTHER_THEME_ID = "665f1c2e8f1b2c3d4e5f6a7c";
const CODE_MESSAGE = "Use 3 to 32 letters, numbers and dashes.";
const PERCENT_MESSAGE = "Enter a whole number from 1 to 100.";
const AMOUNT_MESSAGE = "Enter an amount between $1.00 and $1,000.00.";

const VALID_INPUT = {
  code: "SAVE20",
  type: "percent",
  value: "20",
  appliesTo: "all",
  themeIds: [] as string[],
  expiresAt: "",
  maxRedemptions: "",
};

function messagesOf(result: { error?: { issues: { message: string }[] } }): string[] {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("couponInputSchema", () => {
  it("uppercases and trims the code; refuses 'ab' and 'save 20' with the format message", () => {
    const parsed = couponInputSchema.safeParse({ ...VALID_INPUT, code: "  save-20 " });
    const tooShort = couponInputSchema.safeParse({ ...VALID_INPUT, code: "ab" });
    const withSpace = couponInputSchema.safeParse({ ...VALID_INPUT, code: "save 20" });

    expect(parsed.data?.code).toBe("SAVE-20");
    expect(messagesOf(tooShort)).toEqual([CODE_MESSAGE]);
    expect(tooShort.error?.issues[0]?.path).toEqual(["code"]);
    expect(messagesOf(withSpace)).toEqual([CODE_MESSAGE]);
  });

  it("percent: '20' becomes percentOff 20 and amountOffCents null; refuses '0', '101' and '12.5'", () => {
    const parsed = couponInputSchema.safeParse(VALID_INPUT);

    expect(parsed.data).toEqual({
      code: "SAVE20",
      type: "percent",
      percentOff: 20,
      amountOffCents: null,
      appliesTo: "all",
      themeIds: [],
      expiresAt: null,
      maxRedemptions: null,
    });
    for (const value of ["0", "101", "12.5"]) {
      const result = couponInputSchema.safeParse({ ...VALID_INPUT, value });
      expect(messagesOf(result)).toEqual([PERCENT_MESSAGE]);
      expect(result.error?.issues[0]?.path).toEqual(["value"]);
    }
  });

  it("fixed: '5.00' becomes amountOffCents 500 and percentOff null; refuses '0.5', '1000.01' and '12.345'", () => {
    const parsed = couponInputSchema.safeParse({ ...VALID_INPUT, type: "fixed", value: "5.00" });

    expect(parsed.data?.amountOffCents).toBe(500);
    expect(parsed.data?.percentOff).toBeNull();
    for (const value of ["0.5", "1000.01", "12.345"]) {
      const result = couponInputSchema.safeParse({ ...VALID_INPUT, type: "fixed", value });
      expect(messagesOf(result)).toEqual([AMOUNT_MESSAGE]);
    }
  });

  it("refuses an unknown type and an unknown appliesTo", () => {
    const badType = couponInputSchema.safeParse({ ...VALID_INPUT, type: "free" });
    const badAppliesTo = couponInputSchema.safeParse({ ...VALID_INPUT, appliesTo: "some" });

    expect(messagesOf(badType)).toContain("Choose a discount type.");
    expect(messagesOf(badAppliesTo)).toEqual(["Choose which themes the coupon works for."]);
  });

  it("'selected' needs 1 theme; 'all' forces themeIds to []", () => {
    const none = couponInputSchema.safeParse({ ...VALID_INPUT, appliesTo: "selected", themeIds: [] });
    const some = couponInputSchema.safeParse({
      ...VALID_INPUT,
      appliesTo: "selected",
      themeIds: [THEME_ID, OTHER_THEME_ID, THEME_ID],
    });
    const tooMany = couponInputSchema.safeParse({
      ...VALID_INPUT,
      appliesTo: "selected",
      themeIds: Array.from({ length: 101 }, (_, index) => String(index)),
    });
    const all = couponInputSchema.safeParse({ ...VALID_INPUT, appliesTo: "all", themeIds: [THEME_ID] });

    expect(messagesOf(none)).toEqual(["Choose at least one theme."]);
    expect(none.error?.issues[0]?.path).toEqual(["themeIds"]);
    expect(some.data?.themeIds).toEqual([THEME_ID, OTHER_THEME_ID]);
    expect(messagesOf(tooMany)).toEqual(["Choose up to 100 themes."]);
    expect(all.data?.themeIds).toEqual([]);
  });

  it("empty expiresAt and maxRedemptions become null; '2026-12-31' becomes 2026-12-31T23:59:59.999Z; '2026-02-31' is refused", () => {
    const empty = couponInputSchema.safeParse(VALID_INPUT);
    const filled = couponInputSchema.safeParse({ ...VALID_INPUT, expiresAt: "2026-12-31", maxRedemptions: "10" });
    const badDate = couponInputSchema.safeParse({ ...VALID_INPUT, expiresAt: "2026-02-31" });
    const badLimit = couponInputSchema.safeParse({ ...VALID_INPUT, maxRedemptions: "0" });
    const textLimit = couponInputSchema.safeParse({ ...VALID_INPUT, maxRedemptions: "1.5" });

    expect(empty.data?.expiresAt).toBeNull();
    expect(empty.data?.maxRedemptions).toBeNull();
    expect(filled.data?.expiresAt).toEqual(new Date("2026-12-31T23:59:59.999Z"));
    expect(filled.data?.maxRedemptions).toBe(10);
    expect(messagesOf(badDate)).toEqual(["Enter a valid date."]);
    expect(messagesOf(badLimit)).toEqual(["Enter a whole number of 1 or more."]);
    expect(messagesOf(textLimit)).toEqual(["Enter a whole number of 1 or more."]);
  });
});

describe("couponUpdateSchema", () => {
  it("applies the same rules as the create schema plus active", () => {
    const parsed = couponUpdateSchema.safeParse({
      ...VALID_INPUT,
      code: " new-code ",
      type: "fixed",
      value: "5.00",
      appliesTo: "selected",
      themeIds: [THEME_ID],
      expiresAt: "2026-12-31",
      maxRedemptions: "3",
      active: false,
    });
    const badCode = couponUpdateSchema.safeParse({ ...VALID_INPUT, code: "ab", active: true });
    const badValue = couponUpdateSchema.safeParse({ ...VALID_INPUT, value: "101", active: true });
    const noActive = couponUpdateSchema.safeParse(VALID_INPUT);

    expect(parsed.data).toEqual({
      code: "NEW-CODE",
      type: "fixed",
      percentOff: null,
      amountOffCents: 500,
      appliesTo: "selected",
      themeIds: [THEME_ID],
      expiresAt: new Date("2026-12-31T23:59:59.999Z"),
      maxRedemptions: 3,
      active: false,
    });
    expect(messagesOf(badCode)).toEqual([CODE_MESSAGE]);
    expect(messagesOf(badValue)).toEqual([PERCENT_MESSAGE]);
    expect(noActive.success).toBe(false);
    expect(couponUpdateSchema.safeParse({ ...VALID_INPUT, active: true }).data?.active).toBe(true);
  });
});
