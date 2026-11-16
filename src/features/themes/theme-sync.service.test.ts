import { describe, expect, it, vi } from "vitest";
import { ThemeModel } from "@/features/themes/theme.model";
import { retryThemeSync, syncThemeWithProvider } from "@/features/themes/theme-sync.service";
import { setTestNow } from "@/shared/lib/clock";
import { fakePaymentProvider } from "@/shared/test/fakes/fake-payment-provider";
import { createTheme } from "@/shared/test/factories";

const FIXED_NOW = new Date("2026-11-01T10:00:00Z");
const SYNC_FAILED = "The sync did not work. Please try again in a moment.";
const UNKNOWN_ID = "665f1c2e8f1b2c3d4e5f6a7b";

function silenceConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

describe("syncThemeWithProvider", () => {
  it("saves provider.productId and provider.syncedAt = now()", async () => {
    setTestNow(FIXED_NOW);
    const theme = await createTheme();
    const themeId = theme._id.toString();

    const result = await syncThemeWithProvider(themeId);

    expect(result).toBe(true);
    const saved = await ThemeModel.findById(themeId).lean();
    expect(saved?.provider.productId).toBe("fake_prod_" + themeId);
    expect(saved?.provider.syncedAt).toEqual(FIXED_NOW);
  });

  it("sends the saved product id as existingProductId on the second call", async () => {
    setTestNow(FIXED_NOW);
    const theme = await createTheme();
    const themeId = theme._id.toString();

    await syncThemeWithProvider(themeId);
    await syncThemeWithProvider(themeId);

    expect(fakePaymentProvider.calls).toEqual([
      {
        method: "upsertProduct",
        input: {
          themeId,
          name: theme.name,
          tagline: theme.tagline,
          priceCents: 2900,
          existingProductId: null,
        },
      },
      {
        method: "upsertProduct",
        input: {
          themeId,
          name: theme.name,
          tagline: theme.tagline,
          priceCents: 2900,
          existingProductId: "fake_prod_" + themeId,
        },
      },
    ]);
  });

  it("returns false and leaves provider as { productId: null, syncedAt: null } when the provider fails", async () => {
    const consoleError = silenceConsoleError();
    const theme = await createTheme();
    fakePaymentProvider.failNext(new Error("Polar is down"));

    try {
      const result = await syncThemeWithProvider(theme._id.toString());

      expect(result).toBe(false);
      const saved = await ThemeModel.findById(theme._id).lean();
      expect(saved?.provider).toEqual({ productId: null, syncedAt: null });
    } finally {
      consoleError.mockRestore();
    }
  });

  it("returns false for an unknown theme without calling the provider", async () => {
    const result = await syncThemeWithProvider(UNKNOWN_ID);

    expect(result).toBe(false);
    expect(fakePaymentProvider.calls).toEqual([]);
  });
});

describe("retryThemeSync", () => {
  it("saves the product id after an earlier failure", async () => {
    setTestNow(FIXED_NOW);
    const consoleError = silenceConsoleError();
    const theme = await createTheme();
    const themeId = theme._id.toString();
    fakePaymentProvider.failNext(new Error("Polar is down"));
    await syncThemeWithProvider(themeId);

    try {
      await retryThemeSync(themeId);

      const saved = await ThemeModel.findById(themeId).lean();
      expect(saved?.provider.productId).toBe("fake_prod_" + themeId);
      expect(saved?.provider.syncedAt).toEqual(FIXED_NOW);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("refuses with INVALID when the provider fails; an unknown id is NOT_FOUND", async () => {
    const consoleError = silenceConsoleError();
    const theme = await createTheme();
    fakePaymentProvider.failNext(new Error("Polar is down"));

    try {
      await expect(retryThemeSync(theme._id.toString())).rejects.toMatchObject({
        code: "INVALID",
        message: SYNC_FAILED,
      });
      await expect(retryThemeSync(UNKNOWN_ID)).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Theme not found.",
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
