import { describe, expect, it, vi } from "vitest";
import { syncThemeProduct } from "@/features/payments/payment-sync.service";
import { fakePaymentProvider } from "@/shared/test/fakes/fake-payment-provider";

const THEME_ID = "665f1c2e8f1b2c3d4e5f6a7b";
const INPUT = {
  themeId: THEME_ID,
  name: "Aurora Blog",
  tagline: "A calm theme for writers",
  priceCents: 2900,
  existingProductId: "fake_prod_old",
};

describe("syncThemeProduct", () => {
  it("sends theme id, name, tagline, price and existing product id to the provider and returns the product id", async () => {
    const result = await syncThemeProduct(INPUT);

    expect(result).toEqual({ ok: true, productId: "fake_prod_" + THEME_ID });
    expect(fakePaymentProvider.calls).toEqual([{ method: "upsertProduct", input: INPUT }]);
  });

  it("returns { ok: false } and does not throw when the provider fails; the failure is logged", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("Polar is down");
    fakePaymentProvider.failNext(failure);

    try {
      const result = await syncThemeProduct(INPUT);

      expect(result).toEqual({ ok: false });
      expect(consoleError).toHaveBeenCalledWith("syncThemeProduct failed", failure);
    } finally {
      consoleError.mockRestore();
    }
  });
});
