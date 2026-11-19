import mongoose from "mongoose";
import { connectDB } from "@/shared/db/connect";
import { ALL_MODELS } from "@/shared/db/models";

const BETTER_AUTH_COLLECTIONS = ["user", "session", "account", "verification"];

async function createBetterAuthCollections(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection is not ready");
  for (const name of BETTER_AUTH_COLLECTIONS) {
    const existing = await db.listCollections({ name }).toArray();
    if (existing.length === 0) await db.createCollection(name);
  }
}

// Creates missing collections and builds the indexes of every model, once, when the server starts.
export async function ensureDatabase(): Promise<void> {
  try {
    await connectDB();
    await createBetterAuthCollections();
    for (const model of ALL_MODELS) {
      await model.createCollection();
      await model.syncIndexes();
    }
    console.warn("database ready");
  } catch (error) {
    console.error("ensureDatabase failed", error);
    throw error;
  }
}
