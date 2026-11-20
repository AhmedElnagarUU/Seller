import { connectDB } from "@/shared/db/connect";
import { AuthAttemptModel } from "@/features/auth/auth-attempt.model";
import type { AUTH_ATTEMPT_KINDS } from "@/features/auth/auth-limit.constants";

type AuthAttemptKind = (typeof AUTH_ATTEMPT_KINDS)[number];

type AuthAttemptFields = { kind: AuthAttemptKind; email: string; ip: string; createdAt: Date };

// Inserts one row. The service gives `createdAt` so the clock of the tests works.
export async function insertAuthAttempt(fields: AuthAttemptFields): Promise<void> {
  await connectDB();
  await AuthAttemptModel.create(fields);
}

// Counts the rows after a moment (the moment itself is not counted). `email` and `ip` are optional filters;
// a given `email` must already be trimmed and lowercased.
export async function countAuthAttemptsSince(filter: {
  kind: AuthAttemptKind;
  email?: string;
  ip?: string;
  since: Date;
}): Promise<number> {
  await connectDB();
  const query: Record<string, unknown> = { kind: filter.kind, createdAt: { $gt: filter.since } };
  if (filter.email !== undefined) query.email = filter.email;
  if (filter.ip !== undefined) query.ip = filter.ip;
  return AuthAttemptModel.countDocuments(query);
}
