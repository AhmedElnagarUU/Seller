import mongoose from "mongoose";
import { connectDB } from "@/shared/db/connect";

async function pingOnce(): Promise<boolean> {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) return false;
  await db.admin().ping();
  return true;
}

// True when MongoDB answers a ping within timeoutMs. No time (0 or less) is never enough. Never throws.
export async function pingDatabase(timeoutMs: number): Promise<boolean> {
  if (timeoutMs <= 0) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([pingOnce().catch(() => false), timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
