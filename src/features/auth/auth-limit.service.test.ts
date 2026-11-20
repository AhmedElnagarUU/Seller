import { describe, expect, it } from "vitest";
import { AuthAttemptModel } from "@/features/auth/auth-attempt.model";
import {
  assertAuthEmailAllowed,
  assertLoginAllowed,
  recordAuthEmail,
  recordFailedLogin,
} from "@/features/auth/auth-limit.service";
import { setTestNow } from "@/shared/lib/clock";

const RATE_LIMITED = { code: "RATE_LIMITED", message: "Too many attempts. Please wait a minute and try again." };
const START = new Date("2026-03-01T10:00:00Z");

async function recordFailures(count: number, email: string, ip: string): Promise<void> {
  for (let index = 0; index < count; index += 1) await recordFailedLogin({ email, ip });
}

describe("assertLoginAllowed", () => {
  it("allows 4 failures and refuses after the 5th for the same email and IP", async () => {
    setTestNow(START);
    await recordFailures(4, "ann@example.com", "1.1.1.1");
    await expect(assertLoginAllowed({ email: "ann@example.com", ip: "1.1.1.1" })).resolves.toBeUndefined();

    await recordFailures(1, "ann@example.com", "1.1.1.1");

    await expect(assertLoginAllowed({ email: "ann@example.com", ip: "1.1.1.1" })).rejects.toMatchObject(RATE_LIMITED);
    expect(await AuthAttemptModel.countDocuments({ kind: "login_failed" })).toBe(5);
  });

  it("counts the same email ignoring case and spaces", async () => {
    setTestNow(START);
    await recordFailures(5, "Ann@Example.com", "1.1.1.1");

    await expect(assertLoginAllowed({ email: " ann@example.com ", ip: "1.1.1.1" })).rejects.toMatchObject(RATE_LIMITED);
    const rows = await AuthAttemptModel.find().lean();
    expect(rows.map((row) => row.email)).toEqual(Array(5).fill("ann@example.com"));
  });

  it("does not block the same email from another IP or another email from the same IP (below 50)", async () => {
    setTestNow(START);
    await recordFailures(5, "ann@example.com", "1.1.1.1");

    await expect(assertLoginAllowed({ email: "ann@example.com", ip: "2.2.2.2" })).resolves.toBeUndefined();
    await expect(assertLoginAllowed({ email: "bob@example.com", ip: "1.1.1.1" })).resolves.toBeUndefined();
  });

  it("refuses an IP after 50 failures on different emails", async () => {
    setTestNow(START);
    for (let index = 0; index < 49; index += 1) await recordFailures(1, `user${index}@example.com`, "1.1.1.1");
    await expect(assertLoginAllowed({ email: "new@example.com", ip: "1.1.1.1" })).resolves.toBeUndefined();

    await recordFailures(1, "user49@example.com", "1.1.1.1");

    await expect(assertLoginAllowed({ email: "new@example.com", ip: "1.1.1.1" })).rejects.toMatchObject(RATE_LIMITED);
    await expect(assertLoginAllowed({ email: "new@example.com", ip: "2.2.2.2" })).resolves.toBeUndefined();
  });

  it("allows again after 15 minutes", async () => {
    setTestNow(START);
    await recordFailures(5, "ann@example.com", "1.1.1.1");
    await expect(assertLoginAllowed({ email: "ann@example.com", ip: "1.1.1.1" })).rejects.toMatchObject(RATE_LIMITED);

    setTestNow(new Date(START.getTime() + 15 * 60 * 1000 + 1000));

    await expect(assertLoginAllowed({ email: "ann@example.com", ip: "1.1.1.1" })).resolves.toBeUndefined();
  });
});

describe("assertAuthEmailAllowed", () => {
  it("allows 3 emails per hour per address and refuses the 4th; allows again after 60 minutes", async () => {
    setTestNow(START);
    for (let index = 0; index < 3; index += 1) {
      await expect(assertAuthEmailAllowed({ email: "ann@example.com", ip: "1.1.1.1" })).resolves.toBeUndefined();
      await recordAuthEmail({ email: " Ann@example.com", ip: "1.1.1.1" });
    }

    await expect(assertAuthEmailAllowed({ email: "ann@example.com", ip: "1.1.1.1" })).rejects.toMatchObject(
      RATE_LIMITED,
    );
    await expect(assertAuthEmailAllowed({ email: "bob@example.com", ip: "1.1.1.1" })).resolves.toBeUndefined();
    expect(await AuthAttemptModel.countDocuments({ kind: "auth_email" })).toBe(3);

    setTestNow(new Date(START.getTime() + 60 * 60 * 1000 + 1000));

    await expect(assertAuthEmailAllowed({ email: "ann@example.com", ip: "1.1.1.1" })).resolves.toBeUndefined();
  });
});

describe("auth attempt model", () => {
  it("keeps rows for one day", async () => {
    await AuthAttemptModel.init();

    const indexes = await AuthAttemptModel.collection.indexes();
    const retentionIndex = indexes.find((index) => index.expireAfterSeconds !== undefined);
    expect(retentionIndex?.key).toEqual({ createdAt: 1 });
    expect(retentionIndex?.expireAfterSeconds).toBe(86400);
  });
});
