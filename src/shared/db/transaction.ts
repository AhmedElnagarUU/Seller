import mongoose, { type ClientSession } from "mongoose";

// Runs fn inside a MongoDB transaction; every write rolls back if fn throws.
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  return mongoose.connection.transaction(fn);
}
