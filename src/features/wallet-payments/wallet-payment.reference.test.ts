import { describe, expect, it } from "vitest";
import { WALLET_REFERENCE_PATTERN } from "@/features/wallet-payments/wallet-payment.constants";
import { generateReferenceCode } from "@/features/wallet-payments/wallet-payment.reference";

describe("generateReferenceCode", () => {
  it("500 codes all match WALLET_REFERENCE_PATTERN and never contain 0, O, 1 or I", () => {
    for (let index = 0; index < 500; index += 1) {
      const code = generateReferenceCode();
      expect(code).toMatch(WALLET_REFERENCE_PATTERN);
      expect(code.slice(3)).not.toMatch(/[01OI]/);
    }
  });
});
