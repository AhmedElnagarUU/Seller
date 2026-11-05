import mongoose from "mongoose";
import { env } from "@/shared/config/env";

type MongooseCache = { promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as typeof globalThis & { mongooseCache?: MongooseCache };
const cache: MongooseCache = (globalForMongoose.mongooseCache ??= { promise: null });

// Opens the MongoDB connection once and reuses it (also across hot reloads).
export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  cache.promise ??= mongoose.connect(env.MONGODB_URI);
  try {
    return await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
}
