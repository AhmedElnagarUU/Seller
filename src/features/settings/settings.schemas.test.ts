import { describe, expect, it } from "vitest";
import { walletSettingsSchema } from "@/features/settings/settings.schemas";

const RATE_MESSAGE = "Enter a rate between 1 and 1000 with up to 2 decimals.";

function account(label = "Vodafone Cash", accountText = "01012345678", instructions = "") {
  return { label, account: accountText, instructions };
}

function parse(overrides: { usdToEgpRate?: string; walletAccounts?: ReturnType<typeof account>[] }) {
  return walletSettingsSchema.safeParse({
    walletEnabled: true,
    usdToEgpRate: "50",
    walletAccounts: [account()],
    ...overrides,
  });
}

function messagesOf(result: ReturnType<typeof parse>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("walletSettingsSchema", () => {
  it("accepts '50.5' and turns the text into a number", () => {
    const result = parse({ usdToEgpRate: "50.5" });

    expect(result.success).toBe(true);
    expect(result.data?.usdToEgpRate).toBe(50.5);
  });

  it("refuses '0.5', '1000.01', '12.345' and 'abc' with the rate message", () => {
    for (const rate of ["0.5", "1000.01", "12.345", "abc"]) {
      expect(messagesOf(parse({ usdToEgpRate: rate }))).toEqual([RATE_MESSAGE]);
    }
  });

  it("refuses 6 accounts", () => {
    const rows = Array.from({ length: 6 }, (_, index) => account(`Wallet ${index}`));

    expect(messagesOf(parse({ walletAccounts: rows }))).toEqual(["You can add up to 5 wallet accounts."]);
    expect(parse({ walletAccounts: rows.slice(0, 5) }).success).toBe(true);
  });

  it("drops an all-empty row", () => {
    const result = parse({ walletAccounts: [account(), account("", "", ""), account(" ", "  ", "")] });

    expect(result.success).toBe(true);
    expect(result.data?.walletAccounts).toEqual([account()]);
  });

  it("refuses a label of 1 character with the label message", () => {
    expect(messagesOf(parse({ walletAccounts: [account("V")] }))).toEqual(["Use 2 to 40 characters."]);
  });

  it("reports row errors under the field key walletAccounts", () => {
    const result = parse({ walletAccounts: [account("Vodafone Cash", "0")] });

    expect(result.success ? [] : result.error.issues.map((issue) => issue.path[0])).toEqual(["walletAccounts"]);
    expect(messagesOf(result)).toEqual(["Use 2 to 100 characters."]);
  });
});
