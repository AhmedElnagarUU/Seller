import { describe, expect, it, vi } from "vitest";

// setup.ts replaces this module with the fake, so the real one is loaded here. Signing needs no network.
const s3 = await vi.importActual<typeof import("@/shared/storage/s3")>("@/shared/storage/s3");

function signedHeadersOf(url: URL): string[] {
  return (url.searchParams.get("X-Amz-SignedHeaders") ?? "").split(";");
}

describe("createUploadUrl", () => {
  it("signs content type, length and cache control for the public bucket", async () => {
    const result = await s3.createUploadUrl({
      bucket: "public",
      key: "theme-images/abc/x.png",
      contentType: "image/png",
      sizeBytes: 1000,
      cacheControl: "public, max-age=31536000, immutable",
      expiresInSeconds: 600,
    });

    const url = new URL(result.url);
    expect(url.host).toBe("localhost:9000");
    expect(url.pathname).toBe("/store-images/theme-images/abc/x.png");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(signedHeadersOf(url)).toContain("content-type");
    expect(signedHeadersOf(url)).toContain("content-length");
    expect(signedHeadersOf(url)).toContain("cache-control");
    expect(result.headers).toEqual({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    expect(result.key).toBe("theme-images/abc/x.png");
    const parameterNames = [...url.searchParams.keys()].map((name) => name.toLowerCase());
    expect(parameterNames.filter((name) => name.startsWith("x-amz-checksum"))).toEqual([]);
    expect(parameterNames.filter((name) => name.startsWith("x-amz-sdk-checksum"))).toEqual([]);
  });

  it("leaves out cache control when it is null", async () => {
    const result = await s3.createUploadUrl({
      bucket: "private",
      key: "theme-zips/abc/x.zip",
      contentType: "application/zip",
      sizeBytes: 5000,
      cacheControl: null,
      expiresInSeconds: 600,
    });

    const url = new URL(result.url);
    expect(result.headers).toEqual({ "Content-Type": "application/zip" });
    expect(signedHeadersOf(url)).not.toContain("cache-control");
    expect(signedHeadersOf(url)).toContain("content-type");
    expect(url.pathname.startsWith("/store-files/")).toBe(true);
  });
});

describe("createDownloadUrl", () => {
  it("sets the file name and expiry", async () => {
    const withName = new URL(
      await s3.createDownloadUrl({
        key: "theme-zips/abc/x.zip",
        expiresInSeconds: 300,
        downloadFileName: "aurora-1.0.0.zip",
      }),
    );
    const withoutName = new URL(
      await s3.createDownloadUrl({ key: "wallet-proofs/abc/x.png", expiresInSeconds: 300, downloadFileName: null }),
    );

    expect(withName.pathname).toBe("/store-files/theme-zips/abc/x.zip");
    expect(withName.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(withName.searchParams.get("response-content-disposition")).toBe('attachment; filename="aurora-1.0.0.zip"');
    expect(withoutName.pathname).toBe("/store-files/wallet-proofs/abc/x.png");
    expect(withoutName.searchParams.has("response-content-disposition")).toBe(false);
  });
});
