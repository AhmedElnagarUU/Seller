import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { toWalletPaymentDTO } from "@/features/wallet-payments/wallet-payment.mapper";
import type { WalletPaymentRecord } from "@/features/wallet-payments/wallet-payment.model";

const SUBMITTED_AT = new Date("2026-11-01T10:00:00Z");

function record(overrides: Partial<WalletPaymentRecord> = {}): WalletPaymentRecord {
  return {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    themeId: new Types.ObjectId(),
    themeSnapshot: { name: "Aurora", slug: "aurora" },
    referenceCode: "TS-ABCDEF",
    status: "submitted",
    isOpen: true,
    usdPriceCents: 2900,
    usdDiscountCents: 0,
    couponId: null,
    couponCode: null,
    exchangeRate: 50,
    amountEgp: 1450,
    senderPhone: "01012345678",
    transactionId: "TX-1",
    proof: { key: "wallet-proofs/x/abc.png", contentType: "image/png", sizeBytes: 1000 },
    submittedAt: SUBMITTED_AT,
    reviewedAt: null,
    reviewedByUserId: null,
    rejectionReason: null,
    orderId: null,
    createdAt: SUBMITTED_AT,
    updatedAt: SUBMITTED_AT,
    ...overrides,
  };
}

describe("toWalletPaymentDTO", () => {
  it("maps the snapshot, amounts and nullable fields", () => {
    const payment = record();

    expect(toWalletPaymentDTO(payment)).toEqual({
      id: payment._id.toString(),
      status: "submitted",
      themeId: payment.themeId.toString(),
      themeName: "Aurora",
      themeSlug: "aurora",
      referenceCode: "TS-ABCDEF",
      amountEgp: 1450,
      senderPhone: "01012345678",
      transactionId: "TX-1",
      submittedAt: SUBMITTED_AT,
      rejectionReason: null,
    });
  });

  it("gives null for the fields that are not set", () => {
    const dto = toWalletPaymentDTO(
      record({ status: "awaiting_payment", senderPhone: null, transactionId: null, submittedAt: null }),
    );

    expect(dto.senderPhone).toBeNull();
    expect(dto.transactionId).toBeNull();
    expect(dto.submittedAt).toBeNull();
    expect(dto.rejectionReason).toBeNull();
  });
});
