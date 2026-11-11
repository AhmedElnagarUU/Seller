import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import { setTestNow } from "@/shared/lib/clock";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";
import { fakeStorage, type FakeStorage } from "@/shared/test/fakes/fake-storage";

// External boundary: emails are never sent in tests (docs/10-testing.md section 4).
vi.mock("@/features/emails/email.sender", () => ({
  getEmailSender: () => fakeEmailSender,
}));

// External boundary: files are never sent to S3 in tests (docs/10-testing.md section 4).
vi.mock("@/shared/storage/s3", () => ({
  createUploadUrl: (...args: Parameters<FakeStorage["createUploadUrl"]>) => fakeStorage.createUploadUrl(...args),
  createDownloadUrl: (...args: Parameters<FakeStorage["createDownloadUrl"]>) => fakeStorage.createDownloadUrl(...args),
  headObject: (...args: Parameters<FakeStorage["headObject"]>) => fakeStorage.headObject(...args),
  hashObject: (...args: Parameters<FakeStorage["hashObject"]>) => fakeStorage.hashObject(...args),
  deleteObject: (...args: Parameters<FakeStorage["deleteObject"]>) => fakeStorage.deleteObject(...args),
}));

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI ?? "");
});

beforeEach(async () => {
  const collections = await mongoose.connection.db?.collections();
  for (const collection of collections ?? []) {
    await collection.deleteMany({});
  }
  setTestNow(null);
  fakeEmailSender.reset();
  fakeStorage.reset();
});

afterAll(async () => {
  await mongoose.disconnect();
});
