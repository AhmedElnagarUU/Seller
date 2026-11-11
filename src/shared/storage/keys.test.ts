import { describe, expect, it } from "vitest";
import {
  newThemeImageKey,
  newThemeZipKey,
  newWalletProofKey,
  themeImagePrefix,
  themeZipPrefix,
  walletProofPrefix,
} from "@/shared/storage/keys";

describe("newThemeImageKey", () => {
  it("builds `theme-images/<themeId>/<16 hex>.<ext>`", () => {
    const jpegKey = newThemeImageKey("abc", "image/jpeg");

    expect(jpegKey).toMatch(/^theme-images\/abc\/[0-9a-f]{16}\.jpg$/);
    expect(newThemeImageKey("abc", "image/png")).toMatch(/^theme-images\/abc\/[0-9a-f]{16}\.png$/);
    expect(newThemeImageKey("abc", "image/webp")).toMatch(/^theme-images\/abc\/[0-9a-f]{16}\.webp$/);
    const randomPart = jpegKey.slice("theme-images/abc/".length, -".jpg".length);
    expect(randomPart).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("keys", () => {
  it("every call gives a new key", () => {
    const first = newThemeZipKey("abc");
    const second = newThemeZipKey("abc");

    expect(first).not.toBe(second);
    expect(first).toMatch(/^theme-zips\/abc\/[0-9a-f]{16}\.zip$/);
    expect(second).toMatch(/^theme-zips\/abc\/[0-9a-f]{16}\.zip$/);
  });
});

describe("prefixes", () => {
  it('`themeZipPrefix("abc")` is `"theme-zips/abc/"`, `themeImagePrefix("abc")` is `"theme-images/abc/"`, `walletProofPrefix("abc")` is `"wallet-proofs/abc/"`', () => {
    expect(themeZipPrefix("abc")).toBe("theme-zips/abc/");
    expect(themeImagePrefix("abc")).toBe("theme-images/abc/");
    expect(walletProofPrefix("abc")).toBe("wallet-proofs/abc/");
    expect(newWalletProofKey("abc", "image/png")).toMatch(/^wallet-proofs\/abc\/[0-9a-f]{16}\.png$/);
  });
});
