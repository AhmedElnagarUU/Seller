import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestNow } from "@/shared/lib/clock";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";
import { fakeStorage } from "@/shared/test/fakes/fake-storage";
import { createUser, createWalletPayment, setSettings } from "@/shared/test/factories";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { WalletPaymentModel } from "@/features/wallet-payments/wallet-payment.model";
import { createProofUploadUrl, submitWalletProof } from "@/features/wallet-payments/wallet-payment-proof.service";

const NOW = new Date("2026-11-01T10:00:00Z");
const PROOF_TYPE = "Please upload a JPG, PNG or WebP image up to 5 MB.";
const PHONE = "Please enter the Egyptian mobile number you paid from (11 digits, starts with 01).";
const PROOF_MISSING = "We could not find your screenshot. Please upload it again.";
const NOT_FOUND = "Payment request not found.";
const NOT_CHANGEABLE = "This payment can no longer be changed.";
const FIVE_MB = 5_242_880;

beforeEach(async () => {
  setTestNow(NOW);
  await setSettings({
    walletEnabled: true,
    walletAccounts: [{ label: "Vodafone Cash", account: "01012345678", instructions: "" }],
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function putProof(walletPaymentId: string, overrides: { key?: string; contentType?: string; body?: Buffer } = {}) {
  const key = overrides.key ?? `wallet-proofs/${walletPaymentId}/abc123.png`;
  fakeStorage.putTestObject({
    bucket: "private",
    key,
    contentType: overrides.contentType ?? "image/png",
    body: overrides.body ?? Buffer.alloc(1000, 1),
  });
  return key;
}

async function createAwaiting() {
  const payment = await createWalletPayment();
  return { payment, userId: payment.userId.toString(), walletPaymentId: payment._id.toString() };
}

function submitInput(
  setup: { userId: string; walletPaymentId: string },
  overrides: { senderPhone?: string; transactionId?: string; proofKey?: string } = {},
) {
  return {
    userId: setup.userId,
    walletPaymentId: setup.walletPaymentId,
    senderPhone: "01012345678",
    transactionId: "",
    proofKey: putProof(setup.walletPaymentId),
    ...overrides,
  };
}

describe("createProofUploadUrl", () => {
  it("refuses a GIF, 0 bytes and 5 242 881 bytes → INVALID 'Please upload a JPG, PNG or WebP image up to 5 MB.'", async () => {
    const { userId, walletPaymentId } = await createAwaiting();
    const bad = [
      { contentType: "image/gif", sizeBytes: 1000 },
      { contentType: "image/png", sizeBytes: 0 },
      { contentType: "image/png", sizeBytes: FIVE_MB + 1 },
    ];

    for (const input of bad) {
      await expect(createProofUploadUrl({ userId, walletPaymentId, ...input })).rejects.toMatchObject({
        code: "INVALID",
        message: PROOF_TYPE,
      });
    }

    expect(fakeStorage.uploadUrlRequests).toHaveLength(0);
  });

  it("returns a key wallet-proofs/<id>/<16 hex>.png and the header Content-Type: image/png for a PNG", async () => {
    const { userId, walletPaymentId } = await createAwaiting();

    const upload = await createProofUploadUrl({
      userId,
      walletPaymentId,
      contentType: "image/png",
      sizeBytes: FIVE_MB,
    });

    expect(upload.key).toMatch(new RegExp(`^wallet-proofs/${walletPaymentId}/[a-f0-9]{16}\\.png$`));
    expect(upload.headers["Content-Type"]).toBe("image/png");
    expect(fakeStorage.uploadUrlRequests).toEqual([
      {
        bucket: "private",
        key: upload.key,
        contentType: "image/png",
        sizeBytes: FIVE_MB,
        cacheControl: null,
        expiresInSeconds: 600,
      },
    ]);
  });

  it("refuses another user's request (NOT_FOUND) and a request that is not awaiting_payment (CONFLICT)", async () => {
    const { walletPaymentId } = await createAwaiting();
    const stranger = await createUser();
    const submitted = await createWalletPayment({ status: "submitted" });
    const base = { contentType: "image/png", sizeBytes: 1000 };

    await expect(
      createProofUploadUrl({ userId: stranger._id.toString(), walletPaymentId, ...base }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: NOT_FOUND });
    await expect(
      createProofUploadUrl({ userId: submitted.userId.toString(), walletPaymentId: submitted._id.toString(), ...base }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: NOT_CHANGEABLE });
  });
});

describe("submitWalletProof", () => {
  it("refuses phone numbers '0212345678', '01312345678', '1012345678', '0101234567' → INVALID; status unchanged", async () => {
    const setup = await createAwaiting();

    for (const senderPhone of ["0212345678", "01312345678", "1012345678", "0101234567"]) {
      await expect(submitWalletProof(submitInput(setup, { senderPhone }))).rejects.toMatchObject({
        code: "INVALID",
        message: PHONE,
      });
    }

    const saved = await WalletPaymentModel.findById(setup.walletPaymentId).lean();
    expect(saved?.status).toBe("awaiting_payment");
    expect(saved?.senderPhone).toBeNull();
  });

  it("refuses a proof key of another request → INVALID 'We could not find your screenshot...'; row unchanged", async () => {
    const setup = await createAwaiting();
    const other = await createAwaiting();
    const proofKey = putProof(other.walletPaymentId);

    await expect(submitWalletProof(submitInput(setup, { proofKey }))).rejects.toMatchObject({
      code: "INVALID",
      message: PROOF_MISSING,
    });

    const saved = await WalletPaymentModel.findById(setup.walletPaymentId).lean();
    expect(saved?.status).toBe("awaiting_payment");
    expect(saved?.proof).toEqual({ key: null, contentType: null, sizeBytes: null });
  });

  it("refuses a missing object, an object of type image/gif and an object over 5 MB → the same message", async () => {
    const setup = await createAwaiting();
    const prefix = `wallet-proofs/${setup.walletPaymentId}/`;
    const gifKey = putProof(setup.walletPaymentId, { key: `${prefix}gif.gif`, contentType: "image/gif" });
    const bigKey = putProof(setup.walletPaymentId, { key: `${prefix}big.png`, body: Buffer.alloc(FIVE_MB + 1) });

    for (const proofKey of [`${prefix}missing.png`, gifKey, bigKey]) {
      await expect(submitWalletProof(submitInput(setup, { proofKey }))).rejects.toMatchObject({
        code: "INVALID",
        message: PROOF_MISSING,
      });
    }

    expect((await WalletPaymentModel.findById(setup.walletPaymentId).lean())?.status).toBe("awaiting_payment");
  });

  it("saves submitted with phone, transaction id ('' → null), proof, submittedAt now, isOpen true; logs wallet_payment_submitted", async () => {
    const setup = await createAwaiting();
    const input = submitInput(setup);

    await submitWalletProof(input);

    const saved = await WalletPaymentModel.findById(setup.walletPaymentId).lean();
    expect(saved?.status).toBe("submitted");
    expect(saved?.senderPhone).toBe("01012345678");
    expect(saved?.transactionId).toBeNull();
    expect(saved?.proof).toEqual({ key: input.proofKey, contentType: "image/png", sizeBytes: 1000 });
    expect(saved?.submittedAt).toEqual(NOW);
    expect(saved?.isOpen).toBe(true);
    const logs = await ActivityLogModel.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("wallet_payment_submitted");
    expect(logs[0]?.actorRole).toBe("customer");
    expect(logs[0]?.actorUserId?.toString()).toBe(setup.userId);
    expect(logs[0]?.subjectUserId?.toString()).toBe(setup.userId);
    expect(logs[0]?.targetType).toBe("wallet_payment");
    expect(logs[0]?.targetId?.toString()).toBe(setup.walletPaymentId);
    expect(logs[0]?.summary).toBe(`Wallet payment submitted: ${setup.payment.themeSnapshot.name} (1,450 EGP)`);
  });

  it("keeps a transaction id that is typed, without the spaces around it", async () => {
    const setup = await createAwaiting();

    await submitWalletProof(submitInput(setup, { transactionId: "  TX-123  " }));

    expect((await WalletPaymentModel.findById(setup.walletPaymentId).lean())?.transactionId).toBe("TX-123");
  });

  it("emails the first admin address once; an email failure does not change the result", async () => {
    const setup = await createAwaiting();

    await submitWalletProof(submitInput(setup));

    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(fakeEmailSender.sent[0]?.to).toBe("admin@example.com");
    expect(fakeEmailSender.sent[0]?.subject).toBe(`New wallet payment to review: ${setup.payment.referenceCode}`);

    const second = await createAwaiting();
    fakeEmailSender.failNext(new Error("email down"));

    await expect(submitWalletProof(submitInput(second))).resolves.toBeUndefined();

    expect((await WalletPaymentModel.findById(second.walletPaymentId).lean())?.status).toBe("submitted");
    expect(fakeEmailSender.sent).toHaveLength(1);
  });

  it("refuses a second submit → CONFLICT; a transaction id of 101 characters → INVALID 'Use up to 100 characters.'", async () => {
    const setup = await createAwaiting();

    await expect(submitWalletProof(submitInput(setup, { transactionId: "x".repeat(101) }))).rejects.toMatchObject({
      code: "INVALID",
      message: "Use up to 100 characters.",
    });
    expect((await WalletPaymentModel.findById(setup.walletPaymentId).lean())?.status).toBe("awaiting_payment");

    await submitWalletProof(submitInput(setup, { transactionId: "x".repeat(100) }));

    await expect(submitWalletProof(submitInput(setup))).rejects.toMatchObject({
      code: "CONFLICT",
      message: NOT_CHANGEABLE,
    });
  });
});
