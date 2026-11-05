import { MongoClient } from "mongodb";
import { env } from "@/shared/config/env";

const globalForMongo = globalThis as typeof globalThis & { authMongoClient?: MongoClient };

// The MongoDB client used only by Better Auth (D-091). Created once and reused across hot reloads.
export function getMongoClient(): MongoClient {
  globalForMongo.authMongoClient ??= new MongoClient(env.MONGODB_URI);
  return globalForMongo.authMongoClient;
}
