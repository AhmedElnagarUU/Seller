import { describe, expect, it } from "vitest";
import { rejectWalletPaymentSchema, submitWalletProofSchema } from "@/features/wallet-payments/wallet-payment.schemas";

const ID = "665f1c2e8f1b2c3d4e5f6a7b";
const PHONE_MESSAGE = "Please enter the Egyptian mobile number you paid from (11 digits, starts with 01).";

function proofInput(overrides: { senderPhone?: string; transactionId?: string } = {}) {
  return {
    walletPaymentId: ID,
    senderPhone: "01012345678",
    transactionId: "",
    proofKey: `wallet-proofs/${ID}/abc.png`,
    ...overrides,
  };
}

describe("submitWalletProofSchema", () => {
  it("accepts '01012345678', refuses '01312345678' with the phone message; an empty transaction id is accepted", () => {
    const accepted = submitWalletProofSchema.safeParse(proofInput());
    const refused = submitWalletProofSchema.safeParse(proofInput({ senderPhone: "01312345678" }));

    expect(accepted.success).toBe(true);
    expect(accepted.data?.transactionId).toBe("");
    expect(refused.success).toBe(false);
    expect(refused.error?.issues.map((issue) => issue.message)).toEqual([PHONE_MESSAGE]);
  });
});

describe("rejectWalletPaymentSchema", () => {
  it("refuses 4 characters with the reason message and accepts 5", () => {
    const refused = rejectWalletPaymentSchema.safeParse({ id: ID, reason: "abcd" });
    const accepted = rejectWalletPaymentSchema.safeParse({ id: ID, reason: "abcde" });

    expect(refused.error?.issues.map((issue) => issue.message)).toEqual(["Write between 5 and 500 characters."]);
    expect(accepted.success).toBe(true);
  });
});
