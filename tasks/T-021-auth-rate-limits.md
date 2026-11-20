# T-021: Limits on login attempts and on auth emails (security fix found before launch)

- Depends on: T-020 (all earlier tasks merged)
- Read first: `AGENTS.md`; `docs/01-decisions.md` D-150 (added with this task); `docs/03-data-model.md` section 20 (added with this task);
  `docs/02-architecture.md` sections 5, 6, 7; `docs/10-testing.md`. Copy the limit pattern of `src/features/feedback/feedback.service.ts`
  (`sendFeedback`: count recent rows, refuse with `RATE_LIMITED`) and the model pattern of `src/features/downloads/download-log.model.ts`.

## Why

Better Auth limits sign-in to 3 requests per 10 s per IP, but **only for requests that go through its HTTP router**
(`/api/auth/*`). Our forms are server actions that call `auth.api.signInEmail`, `auth.api.signUpEmail`,
`auth.api.requestPasswordReset` and `auth.api.sendVerificationEmail` directly, which skips that check. Today a script can
guess passwords without limit and make the store send unlimited reset / verification emails. `AUTH_MESSAGES.tooManyAttempts`
exists but can never be shown.

## Goal

1. Our own limits (D-150), stored in a new collection `authAttempts`:
   - **Failed logins:** at most **5 failed logins per email and IP in 15 minutes**, and **50 failed logins per IP in 15 minutes**.
     Only failures count, so normal logins (and the e2e suite) are never slowed down.
   - **Auth emails** (password reset request, resend verification): at most **3 per email per hour**.
2. The client IP for these limits, and for Better Auth's own router limits (Google login callbacks), is read from
   `cf-connecting-ip` first (Cloudflare sets it, D-146), then the first entry of `x-forwarded-for`, else `"unknown"`.

**Not in this task:** CAPTCHA, account lockout e-mails, limits on registration (a second sign-up with the same email is
already refused), any change to Better Auth's router limits other than the IP header.

## Packages

None.

## Files

```
docs/01-decisions.md                     (already updated with this task: D-150)
docs/03-data-model.md                    (already updated with this task: section 20)

src/features/auth/auth-attempt.model.ts      AuthAttemptModel, AuthAttemptRecord
src/features/auth/auth-attempt.repository.ts insertAuthAttempt, countAuthAttemptsSince
src/features/auth/auth-limit.service.ts      assertLoginAllowed, recordFailedLogin, assertAuthEmailAllowed, recordAuthEmail
src/features/auth/auth-limit.constants.ts    the limits below
src/features/auth/client-ip.ts               readClientIp(headers)
src/features/auth/auth-limit.service.test.ts / client-ip.test.ts
src/features/auth/auth.service.ts            (change) use the limits in loginUser, requestPasswordReset, resendVerificationEmail
src/features/auth/auth.service.test.ts       (change) append the tests below; do not change existing tests
src/features/auth/auth.ts                    (change) advanced.ipAddress.ipAddressHeaders
src/shared/db/models.ts                      (change) add AuthAttemptModel to ALL_MODELS (keep the order by file path)
```

`auth.service.ts` keeps the exception of T-003 (it calls `auth.api.*`); the limit functions go through the new service and
repository like every other feature.

## Model (`auth-attempt.model.ts`, 03 §20)

Collection `authAttempts`, `{ timestamps: { createdAt: true, updatedAt: false } }`:
- `kind`: enum `AUTH_ATTEMPT_KINDS = ["login_failed", "auth_email"]`, required.
- `email`: string, required, trimmed, lowercased (the address the attempt was for).
- `ip`: string, required (`"unknown"` when it cannot be read).
Indexes, in this order: `{ kind: 1, email: 1, ip: 1, createdAt: -1 }`, `{ kind: 1, ip: 1, createdAt: -1 }`,
`{ createdAt: 1 }` with `expireAfterSeconds: AUTH_ATTEMPT_RETENTION_SECONDS` (1 day = 86 400).

## Constants (`auth-limit.constants.ts`)

```ts
export const AUTH_ATTEMPT_KINDS = ["login_failed", "auth_email"] as const;
export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILED_LOGINS_PER_EMAIL_AND_IP = 5;
export const MAX_FAILED_LOGINS_PER_IP = 50;
export const AUTH_EMAIL_WINDOW_MINUTES = 60;
export const MAX_AUTH_EMAILS_PER_EMAIL = 3;
export const AUTH_ATTEMPT_RETENTION_SECONDS = 86_400;
```

## Client IP (`client-ip.ts`)

`readClientIp(headers: Headers): string` — `cf-connecting-ip` (trimmed) when not empty; else the first comma-separated
entry of `x-forwarded-for` (trimmed) when not empty; else `"unknown"`. Pure function. Never logged.

## Service (`auth-limit.service.ts`)

All times from `now()` (`shared/lib/clock`). Emails are trimmed and lowercased before use.

| Function | Rules |
|---|---|
| `assertLoginAllowed({ email, ip }): Promise<void>` | Count `login_failed` rows with this email **and** ip since `now − 15 min`; `>= 5` → `AppError("RATE_LIMITED", AUTH_MESSAGES.tooManyAttempts)`. Count `login_failed` rows with this ip since `now − 15 min`; `>= 50` → same error. |
| `recordFailedLogin({ email, ip }): Promise<void>` | Insert one `login_failed` row. |
| `assertAuthEmailAllowed({ email, ip }): Promise<void>` | Count `auth_email` rows with this email since `now − 60 min`; `>= 3` → same error. |
| `recordAuthEmail({ email, ip }): Promise<void>` | Insert one `auth_email` row. |

## Changes in `auth.service.ts`

- `loginUser(input, headers)`: `const ip = readClientIp(headers)`; **before** calling Better Auth, `await assertLoginAllowed({ email: input.email, ip })`
  (its `AppError` passes through unchanged). When Better Auth answers 401 (wrong email or password): `await recordFailedLogin(...)`,
  then throw the existing `wrongCredentials` error. A disabled account, a 429 or any other error records nothing.
- `requestPasswordReset(email, headers)`: first `assertAuthEmailAllowed` — when it throws `RATE_LIMITED`, **return without an
  error and without sending** (the page must not reveal anything, same as an unknown email today); otherwise `recordAuthEmail`, then
  the existing call. The existing behaviour for unknown emails stays.
- `resendVerificationEmail(email, headers)`: first `assertAuthEmailAllowed` (here the `RATE_LIMITED` error **is** thrown, so the
  logged-in user sees `tooManyAttempts`); then `recordAuthEmail`, then the existing call.

## `auth.ts`

Add inside the existing config: `advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] } }`.
Keep everything else as it is.

## Required tests

`client-ip.test.ts`
- [ ] readClientIp › prefers cf-connecting-ip, then the first x-forwarded-for entry, else "unknown" → `{ "cf-connecting-ip": " 1.2.3.4 ", "x-forwarded-for": "5.6.7.8" }` gives `"1.2.3.4"`; `{ "x-forwarded-for": " 5.6.7.8 , 10.0.0.1" }` gives `"5.6.7.8"`; `{}` gives `"unknown"`; `{ "cf-connecting-ip": "" , "x-forwarded-for": "" }` gives `"unknown"`

`auth-limit.service.test.ts` (in-memory MongoDB, `setTestNow`)
- [ ] assertLoginAllowed › allows 4 failures and refuses after the 5th for the same email and IP → after 4 `recordFailedLogin` it resolves; after the 5th it rejects with `RATE_LIMITED` `"Too many attempts. Please wait a minute and try again."`
- [ ] assertLoginAllowed › counts the same email ignoring case and spaces → failures recorded for `"Ann@Example.com"` block `" ann@example.com "`
- [ ] assertLoginAllowed › does not block the same email from another IP or another email from the same IP (below 50)
- [ ] assertLoginAllowed › refuses an IP after 50 failures on different emails
- [ ] assertLoginAllowed › allows again after 15 minutes → 5 failures at T; at T + 15 min + 1 s it resolves
- [ ] assertAuthEmailAllowed › allows 3 emails per hour per address and refuses the 4th; allows again after 60 minutes
- [ ] auth attempt model › keeps rows for one day → TTL index `{ createdAt: 1 }` with `expireAfterSeconds 86400`

`auth.service.test.ts` (append)
- [ ] loginUser › records a failed login and refuses the 6th try with the right password → 5 wrong passwords (each `INVALID` `wrongCredentials`), then the correct password rejects with `RATE_LIMITED`; 5 `login_failed` rows; no new session
- [ ] loginUser › a successful login records nothing → 0 `authAttempts` rows
- [ ] requestPasswordReset › sends at most 3 reset emails per hour for one address and stays silent after that → 4 calls resolve; `fakeEmailSender.sent` has 3 reset emails
- [ ] resendVerificationEmail › refuses the 4th within an hour with `RATE_LIMITED` (use a registered, unverified user; the registration email itself is not counted)

`ensure-database.test.ts` keeps passing (the new model file and `ALL_MODELS` entry keep the counts equal).

Break check (≥ 3): remove the per-email-and-IP check; count successful logins too (record before the 401 check); drop the
lowercase of the email; make `requestPasswordReset` throw instead of returning silently.

## Do NOT

- Do not log emails together with IPs, passwords, or tokens. Do not show whether an email exists.
- Do not change existing tests. Do not change Better Auth's rate-limit options other than the IP header.
- No `any`, no `@ts-ignore`, no `eslint-disable`.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm test:coverage && pnpm build && pnpm e2e
```

Commit: `T-021: limits on login attempts and auth emails`
