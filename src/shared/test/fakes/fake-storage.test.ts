import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FakeStorage } from "@/shared/test/fakes/fake-storage";

const KEY = "theme-images/abc/1.png";

describe("FakeStorage", () => {
  it("headObject returns null for a missing object and the size and type of a stored one", async () => {
    const storage = new FakeStorage();
    storage.putTestObject({ bucket: "public", key: KEY, contentType: "image/png", body: "12345" });

    expect(await storage.headObject({ bucket: "public", key: "theme-images/abc/missing.png" })).toBeNull();
    expect(await storage.headObject({ bucket: "private", key: KEY })).toBeNull();
    expect(await storage.headObject({ bucket: "public", key: KEY })).toEqual({
      sizeBytes: 5,
      contentType: "image/png",
    });
  });

  it("hashObject returns the real SHA-256 and the first 4 bytes", async () => {
    const storage = new FakeStorage();
    const body = "PK\u0003\u0004abc";
    storage.putTestObject({ bucket: "private", key: "theme-zips/abc/1.zip", contentType: "application/zip", body });

    const result = await storage.hashObject({ bucket: "private", key: "theme-zips/abc/1.zip" });

    expect(result.firstBytesHex).toBe("504b0304");
    expect(result.sha256).toBe(createHash("sha256").update(body).digest("hex"));
    await expect(storage.hashObject({ bucket: "private", key: "theme-zips/abc/missing.zip" })).rejects.toThrow(
      new Error("FAKE_STORAGE_OBJECT_NOT_FOUND"),
    );
  });

  it("deleteObject removes the object and `failNextDelete` makes the next delete throw once", async () => {
    const storage = new FakeStorage();
    storage.putTestObject({ bucket: "public", key: KEY, contentType: "image/png", body: "12345" });
    storage.failNextDelete(new Error("boom"));

    await expect(storage.deleteObject({ bucket: "public", key: KEY })).rejects.toThrow(new Error("boom"));
    expect(storage.objects.has(`public/${KEY}`)).toBe(true);

    await storage.deleteObject({ bucket: "public", key: KEY });
    expect(storage.objects.has(`public/${KEY}`)).toBe(false);
    await expect(storage.deleteObject({ bucket: "public", key: KEY })).resolves.toBeUndefined();
  });

  it("reset clears objects and recorded requests", async () => {
    const storage = new FakeStorage();
    storage.putTestObject({ bucket: "public", key: KEY, contentType: "image/png", body: "12345" });
    const upload = await storage.createUploadUrl({
      bucket: "public",
      key: KEY,
      contentType: "image/png",
      sizeBytes: 5,
      cacheControl: null,
      expiresInSeconds: 600,
    });
    const downloadUrl = await storage.createDownloadUrl({
      key: "theme-zips/abc/1.zip",
      expiresInSeconds: 300,
      downloadFileName: "aurora 1.zip",
    });
    storage.failNextDelete(new Error("boom"));
    expect(upload).toEqual({
      key: KEY,
      url: `https://fake-storage.test/public/${KEY}?upload=1`,
      headers: { "Content-Type": "image/png" },
    });
    expect(downloadUrl).toBe(
      "https://fake-storage.test/private/theme-zips/abc/1.zip?expires=300&filename=aurora%201.zip",
    );
    expect(storage.uploadUrlRequests).toHaveLength(1);
    expect(storage.downloadUrlRequests).toHaveLength(1);

    storage.reset();

    expect(storage.objects.size).toBe(0);
    expect(storage.uploadUrlRequests).toEqual([]);
    expect(storage.downloadUrlRequests).toEqual([]);
    await expect(storage.deleteObject({ bucket: "public", key: KEY })).resolves.toBeUndefined();
  });
});
