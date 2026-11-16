import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function importEnv() {
  vi.resetModules();
  return import("@/shared/config/env");
}

function stubProductionEmail(): void {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("EMAIL_TRANSPORT", "resend");
  vi.stubEnv("RESEND_API_KEY", "key");
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env", () => {
  it("refuses PAYMENT_PROVIDER=fake when APP_ENV=production", async () => {
    stubProductionEmail();
    vi.stubEnv("PAYMENT_PROVIDER", "fake");

    await expect(importEnv()).rejects.toThrow("Invalid or missing environment variables: PAYMENT_PROVIDER");
  });

  it("accepts PAYMENT_PROVIDER=fake when APP_ENV=ci", async () => {
    vi.stubEnv("APP_ENV", "ci");
    vi.stubEnv("PAYMENT_PROVIDER", "fake");

    const { env } = await importEnv();

    expect(env.PAYMENT_PROVIDER).toBe("fake");
    expect(env.APP_ENV).toBe("ci");
    expect(env.POLAR_SERVER).toBe("sandbox");
  });

  it("requires POLAR_ACCESS_TOKEN and POLAR_WEBHOOK_SECRET when PAYMENT_PROVIDER=polar", async () => {
    stubProductionEmail();
    vi.stubEnv("PAYMENT_PROVIDER", "polar");
    vi.stubEnv("POLAR_ACCESS_TOKEN", "");
    vi.stubEnv("POLAR_WEBHOOK_SECRET", "");

    await expect(importEnv()).rejects.toThrow(
      "Invalid or missing environment variables: POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET",
    );
  });

  it("accepts PAYMENT_PROVIDER=polar with both Polar variables", async () => {
    stubProductionEmail();
    vi.stubEnv("PAYMENT_PROVIDER", "polar");
    vi.stubEnv("POLAR_ACCESS_TOKEN", "polar_oat_token");
    vi.stubEnv("POLAR_WEBHOOK_SECRET", "whsec_secret");
    vi.stubEnv("POLAR_SERVER", "production");

    const { env } = await importEnv();

    expect(env.PAYMENT_PROVIDER).toBe("polar");
    expect(env.POLAR_ACCESS_TOKEN).toBe("polar_oat_token");
    expect(env.POLAR_WEBHOOK_SECRET).toBe("whsec_secret");
    expect(env.POLAR_SERVER).toBe("production");
  });
});
