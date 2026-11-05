import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { setTestNow } from "@/shared/lib/clock";

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI ?? "");
});

beforeEach(async () => {
  const collections = await mongoose.connection.db?.collections();
  for (const collection of collections ?? []) {
    await collection.deleteMany({});
  }
  setTestNow(null);
});

afterAll(async () => {
  await mongoose.disconnect();
});
