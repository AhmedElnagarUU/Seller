import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import { setTestNow } from "@/shared/lib/clock";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";

// External boundary: emails are never sent in tests (docs/10-testing.md section 4).
vi.mock("@/features/emails/email.sender", () => ({
  getEmailSender: () => fakeEmailSender,
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
});

afterAll(async () => {
  await mongoose.disconnect();
});
