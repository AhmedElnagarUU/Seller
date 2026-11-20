import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import * as authAttemptRepository from "@/features/auth/auth-attempt.repository";
import {
  AUTH_EMAIL_WINDOW_MINUTES,
  LOGIN_WINDOW_MINUTES,
  MAX_AUTH_EMAILS_PER_EMAIL,
  MAX_FAILED_LOGINS_PER_EMAIL_AND_IP,
  MAX_FAILED_LOGINS_PER_IP,
} from "@/features/auth/auth-limit.constants";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";

const MILLISECONDS_PER_MINUTE = 60 * 1000;

type Attempt = { email: string; ip: string };

function minutesAgo(minutes: number): Date {
  return new Date(now().getTime() - minutes * MILLISECONDS_PER_MINUTE);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Refuses a login when this email + IP, or this IP, failed too often in the last 15 minutes (D-150).
export async function assertLoginAllowed(attempt: Attempt): Promise<void> {
  const since = minutesAgo(LOGIN_WINDOW_MINUTES);
  const failedForEmailAndIp = await authAttemptRepository.countAuthAttemptsSince({
    kind: "login_failed",
    email: normalizeEmail(attempt.email),
    ip: attempt.ip,
    since,
  });
  if (failedForEmailAndIp >= MAX_FAILED_LOGINS_PER_EMAIL_AND_IP) {
    throw new AppError("RATE_LIMITED", AUTH_MESSAGES.tooManyAttempts);
  }
  const failedForIp = await authAttemptRepository.countAuthAttemptsSince({
    kind: "login_failed",
    ip: attempt.ip,
    since,
  });
  if (failedForIp >= MAX_FAILED_LOGINS_PER_IP) throw new AppError("RATE_LIMITED", AUTH_MESSAGES.tooManyAttempts);
}

// Remembers one failed login.
export async function recordFailedLogin(attempt: Attempt): Promise<void> {
  await authAttemptRepository.insertAuthAttempt({
    kind: "login_failed",
    email: normalizeEmail(attempt.email),
    ip: attempt.ip,
    createdAt: now(),
  });
}

// Refuses an auth email (reset, verification) when this address got 3 in the last hour (D-150).
export async function assertAuthEmailAllowed(attempt: Attempt): Promise<void> {
  const sent = await authAttemptRepository.countAuthAttemptsSince({
    kind: "auth_email",
    email: normalizeEmail(attempt.email),
    since: minutesAgo(AUTH_EMAIL_WINDOW_MINUTES),
  });
  if (sent >= MAX_AUTH_EMAILS_PER_EMAIL) throw new AppError("RATE_LIMITED", AUTH_MESSAGES.tooManyAttempts);
}

// Remembers one auth email.
export async function recordAuthEmail(attempt: Attempt): Promise<void> {
  await authAttemptRepository.insertAuthAttempt({
    kind: "auth_email",
    email: normalizeEmail(attempt.email),
    ip: attempt.ip,
    createdAt: now(),
  });
}
