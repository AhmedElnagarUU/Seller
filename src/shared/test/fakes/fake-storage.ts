import { createHash } from "node:crypto";
import type {
  createDownloadUrl,
  createUploadUrl,
  PresignedUpload,
  StorageBucket,
  StoredObjectInfo,
} from "@/shared/storage/s3";

type CreateUploadUrlInput = Parameters<typeof createUploadUrl>[0];
type CreateDownloadUrlInput = Parameters<typeof createDownloadUrl>[0];
type ObjectLocation = { bucket: StorageBucket; key: string };

export type FakeStoredObject = {
  bucket: StorageBucket;
  key: string;
  contentType: string;
  sizeBytes: number;
  body: Buffer;
};

const FAKE_BASE_URL = "https://fake-storage.test";
const FIRST_BYTES_COUNT = 4;

function mapKey(location: ObjectLocation): string {
  return `${location.bucket}/${location.key}`;
}

// Test double for the storage module (docs/10-testing.md section 4). Keeps objects in memory.
export class FakeStorage {
  // Map key = `${bucket}/${key}`, e.g. "public/theme-images/abc/1.png".
  objects = new Map<string, FakeStoredObject>();
  // Every createUploadUrl input, in order.
  uploadUrlRequests: CreateUploadUrlInput[] = [];
  downloadUrlRequests: CreateDownloadUrlInput[] = [];
  private nextDeleteError: Error | null = null;

  async createUploadUrl(input: CreateUploadUrlInput): Promise<PresignedUpload> {
    this.uploadUrlRequests.push(input);
    const headers: Record<string, string> = { "Content-Type": input.contentType };
    if (input.cacheControl !== null) headers["Cache-Control"] = input.cacheControl;
    return { key: input.key, url: `${FAKE_BASE_URL}/${input.bucket}/${input.key}?upload=1`, headers };
  }

  async createDownloadUrl(input: CreateDownloadUrlInput): Promise<string> {
    this.downloadUrlRequests.push(input);
    const url = `${FAKE_BASE_URL}/private/${input.key}?expires=${input.expiresInSeconds}`;
    if (input.downloadFileName === null) return url;
    return `${url}&filename=${encodeURIComponent(input.downloadFileName)}`;
  }

  async headObject(input: ObjectLocation): Promise<StoredObjectInfo | null> {
    const stored = this.objects.get(mapKey(input));
    return stored ? { sizeBytes: stored.sizeBytes, contentType: stored.contentType } : null;
  }

  async hashObject(input: ObjectLocation): Promise<{ sha256: string; firstBytesHex: string }> {
    const stored = this.objects.get(mapKey(input));
    if (!stored) throw new Error("FAKE_STORAGE_OBJECT_NOT_FOUND");
    return {
      sha256: createHash("sha256").update(stored.body).digest("hex"),
      firstBytesHex: stored.body.subarray(0, FIRST_BYTES_COUNT).toString("hex"),
    };
  }

  async deleteObject(input: ObjectLocation): Promise<void> {
    if (this.nextDeleteError) {
      const error = this.nextDeleteError;
      this.nextDeleteError = null;
      throw error;
    }
    this.objects.delete(mapKey(input));
  }

  // Stores an object as if the browser had uploaded it. sizeBytes = body length.
  putTestObject(input: { bucket: StorageBucket; key: string; contentType: string; body: Buffer | string }): void {
    const body = Buffer.from(input.body);
    this.objects.set(mapKey(input), {
      bucket: input.bucket,
      key: input.key,
      contentType: input.contentType,
      sizeBytes: body.length,
      body,
    });
  }

  // The next deleteObject call throws this error.
  failNextDelete(error: Error): void {
    this.nextDeleteError = error;
  }

  reset(): void {
    this.objects = new Map();
    this.uploadUrlRequests = [];
    this.downloadUrlRequests = [];
    this.nextDeleteError = null;
  }
}

// The one shared instance that replaces "@/shared/storage/s3" in tests.
export const fakeStorage = new FakeStorage();
