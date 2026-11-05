# T-003: Accounts — register, login, Google, email verification, password reset, admin check

- Depends on: T-001, T-002
- Read first: `AGENTS.md`; `docs/02-architecture.md` sections 2, 5, 6, 8, 10; `docs/03-data-model.md` section 3;
  `docs/09-emails.md` sections 1, 2, 3 (#1, #2); `docs/01-decisions.md` D-020 – D-024, D-091, D-102, D-119 – D-121;
  `docs/10-testing.md` sections 2 – 4.

## Packages (pin exactly)

dependencies: `better-auth` 1.7.17, `mongodb` 7.8.0 (same as inside mongoose, D-091), `resend` 6.37.0,
`@react-email/components` 1.0.12. Nothing else.

## Env variables added (update `env.ts`, `.env.example`, vitest `test.env`)

| Name | Rule | `.env.example` / test value |
|---|---|---|
| `BETTER_AUTH_SECRET` | string, min 32 chars | `dev-secret-change-me-dev-secret-change-me` |
| `BETTER_AUTH_URL` | url, no trailing slash | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | non-empty | `dev-google-client-id` |
| `GOOGLE_CLIENT_SECRET` | non-empty | `dev-google-client-secret` |
| `ADMIN_EMAILS` | comma-separated; trim + lowercase each; each a valid email; at least 1 → **`string[]`** | `admin@example.com` |
| `EMAIL_TRANSPORT` | `"resend" \| "console"` | `console` |
| `RESEND_API_KEY` | optional string; **required when `EMAIL_TRANSPORT=resend`** | (empty) |
| `EMAIL_FROM` | non-empty | `Theme Store <hello@example.com>` |
| `SUPPORT_EMAIL` | email | `support@example.com` |

Extra rule in `env.ts` (`superRefine`): `EMAIL_TRANSPORT=console` with `NODE_ENV=production` → error
`"EMAIL_TRANSPORT=console is not allowed in production"`.

## Files

```
src/shared/db/mongo-client.ts          getMongoClient(): MongoClient — new MongoClient(env.MONGODB_URI), cached on globalThis
src/shared/lib/countries.ts            COUNTRY_CODES (all ISO 3166-1 alpha-2 codes, as const), isCountryCode(value),
                                       getCountryOptions(): {value,label}[] sorted by label, labels from Intl.DisplayNames("en", { type: "region" })
src/shared/lib/paths.ts                safeNextPath(value: string | null | undefined): string  (02 §8: must start with "/", not "//"; else "/")
src/shared/test/fakes/fake-email-sender.ts   FakeEmailSender (09 §1.2): sent[], failNext(error), reset()
src/shared/test/setup.ts               (change) vi.mock("@/features/emails/email.sender") so getEmailSender() returns the shared fake; reset it beforeEach

src/features/emails/email.types.ts     exactly 09 §1.1
src/features/emails/email.sender.ts    09 §1.2 (Resend + console)
src/features/emails/email.render.ts    renderEmail(element) → { html, text } using render() from @react-email/components (text: { plainText: true })
src/features/emails/email.service.ts   sendVerifyEmail({ to, name, url }), sendResetPasswordEmail({ to, name, url }) — texts exactly 09 §3.1 #1, #2
src/features/emails/templates/EmailLayout.tsx, VerifyEmail.tsx, ResetPasswordEmail.tsx   (09 §2; no settings line on these two)

src/features/users/user.model.ts       Mongoose model on collection "user" (03 §3): name, email, emailVerified (read only), + the 8 extra fields with defaults; { timestamps: true, strict: true }
src/features/users/user.repository.ts  findUserById(id), setUserCountry(id, country), isUserDisabledById(id)
src/features/users/user.service.ts     setUserCountry(userId, country) — invalid code → AppError("INVALID", "Please choose your country."); isUserDisabled(userId): Promise<boolean>; isAdminEmail(email): boolean (lowercase compare with env.ADMIN_EMAILS)
src/features/users/user.types.ts       CurrentUser (02 §8)

src/features/auth/auth.ts              the Better Auth instance (below)
src/features/auth/auth-client.ts       "use client"; createAuthClient() from "better-auth/react" (no baseURL: same origin)
src/features/auth/auth.service.ts      registerUser, loginUser, logoutUser, requestPasswordReset, resetPassword, resendVerificationEmail (below). Takes `headers: Headers` as a parameter; no next/*.
src/features/auth/auth.schemas.ts      registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema
src/features/auth/auth.messages.ts     AUTH_MESSAGES (all texts below, one constant object)
src/features/auth/auth.actions.ts      registerAction, loginAction, logoutAction, forgotPasswordAction, resetPasswordAction, resendVerificationAction
src/features/auth/session.ts           getCurrentUser, requireUser, requireVerifiedUser, requireAdmin (02 §8). getCurrentUser wrapped in React cache().
src/features/auth/components/RegisterForm.tsx, LoginForm.tsx, ForgotPasswordForm.tsx, ResetPasswordForm.tsx,
                            GoogleButton.tsx, AccountMenu.tsx, ResendVerificationForm.tsx

src/app/api/auth/[...all]/route.ts     export const { GET, POST } = toNextJsHandler(auth);
src/app/(auth)/register/page.tsx, login/page.tsx, forgot-password/page.tsx, reset-password/page.tsx, verify-email/page.tsx
src/app/account/page.tsx               temporary account page (below)
src/app/layout.tsx                     (change) accountSlot = <AccountMenu user={await getCurrentUser()} />

e2e/auth.spec.ts
```

Exception to the layer rule, for this feature only: **`auth.service.ts` calls `auth.api.*`** (Better Auth is our
auth "repository"). Actions call `auth.service.ts`, never `auth.api` directly.

## `auth.ts` (configuration — use exactly these options)

```ts
betterAuth({
  appName: "Theme Store",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: mongodbAdapter(getMongoClient().db(), { client: getMongoClient() }),
  emailAndPassword: {
    enabled: true, minPasswordLength: 8, maxPasswordLength: 128,
    requireEmailVerification: false,           // D-023: verified only before buying
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => sendResetPasswordEmail({ to: user.email, name: user.name, url }),
  },
  emailVerification: {
    sendOnSignUp: true, autoSignInAfterVerification: true, expiresIn: 86400,
    sendVerificationEmail: async ({ user, url }) => sendVerifyEmail({ to: user.email, name: user.name, url }),
  },
  socialProviders: { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } },
  user: { additionalFields: { /* the 8 fields of 03 §3, each input: false; country/disabledReason: string required false; disabledAt: date required false; booleans with defaultValue */ } },
  databaseHooks: {
    session: { create: { before: async (session) => {
      if (await isUserDisabled(session.userId)) throw new APIError("FORBIDDEN", { message: "ACCOUNT_DISABLED" });
    } } },
  },
  plugins: [nextCookies()],   // must be last
});
```

If an option name above does not exist in better-auth 1.7.17's types, stop and add a question (do not guess another).

## `auth.service.ts`

| Function | Does | Errors (AppError code, message from AUTH_MESSAGES) |
|---|---|---|
| `registerUser(input: RegisterInput, headers)` | `auth.api.signUpEmail({ body: { name, email, password, callbackURL: "/account" }, headers })`, then `setUserCountry(user.id, country)` | email exists (Better Auth code contains `USER_ALREADY_EXISTS`) → CONFLICT `emailTaken`; other Better Auth error → INVALID `generic` (+ console.error) |
| `loginUser(input: LoginInput, headers)` | `auth.api.signInEmail({ body: { email, password }, headers })` | message `ACCOUNT_DISABLED` → FORBIDDEN `disabled`; status 401 → INVALID `wrongCredentials`; status 429 → RATE_LIMITED `tooManyAttempts`; other → INVALID `generic` |
| `logoutUser(headers)` | `auth.api.signOut({ headers })` | none (ignore errors) |
| `requestPasswordReset(email, headers)` | `auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers })`; **always** resolves (never tells if the email exists) | none |
| `resetPassword(token, newPassword, headers)` | `auth.api.resetPassword({ body: { token, newPassword }, headers })` | any error → INVALID `resetLinkInvalid` |
| `resendVerificationEmail(email, headers)` | `auth.api.sendVerificationEmail({ body: { email, callbackURL: "/account" }, headers })` | 429 → RATE_LIMITED `tooManyAttempts`; other → INVALID `generic` |

Detect Better Auth errors with `isAPIError` from `better-auth/api`.

## Texts (`auth.messages.ts`)

```ts
export const AUTH_MESSAGES = {
  emailTaken: "An account with this email already exists. Log in instead.",
  wrongCredentials: "Wrong email or password.",
  disabled: "This account has been disabled. Contact support if you think this is a mistake.",
  tooManyAttempts: "Too many attempts. Please wait a minute and try again.",
  generic: "Something went wrong. Please try again.",
  resetLinkInvalid: "This reset link is invalid or has expired. Please ask for a new one.",
  resetEmailSent: "If an account exists for this email, we sent a link to reset your password.",
  passwordChanged: "Your password was changed. Please log in.",
  verificationSent: "We sent a new confirmation email.",
  googleFailed: "Google sign-in failed. Please try again.",
  invalidName: "Enter your name (2 to 80 characters).",
  invalidEmail: "Enter a valid email.",
  invalidPassword: "Use 8 to 128 characters.",
  passwordsDiffer: "The passwords do not match.",
  invalidCountry: "Please choose your country.",
} as const;
```

## Schemas

- `registerSchema`: `name` trim 2–80 (`invalidName`), `email` trim lowercase `z.email()` (`invalidEmail`), `password` 8–128 (`invalidPassword`), `country` refine `isCountryCode` (`invalidCountry`).
- `loginSchema`: `email` (`invalidEmail`), `password` 1–128 (`wrongCredentials`).
- `forgotPasswordSchema`: `email`.
- `resetPasswordSchema`: `token` min 1, `password` 8–128, `confirmPassword`; refine equal → error on `confirmPassword`: `passwordsDiffer`.

## Pages and components

All pages use `PageContainer width="narrow"`, a `Card`, `Stack`. Forms use `useActionState` (initial `null`),
`TextField`/`SelectField`, `SubmitButton`, `FormError`. Field errors come from `fieldErrors`.

| Page | Logged-in user | Content |
|---|---|---|
| `/register` | redirect `/account` | Heading "Create your account". Fields: Name (autoComplete name), Email (email), Password (new-password, hint "At least 8 characters."), Country (SelectField, placeholder "Choose your country", default = `cf-ipcountry` request header when `isCountryCode`). Button "Create account" / pending "Creating account…". `Divider label="or"`, `GoogleButton` "Continue with Google". Footer text "Already have an account?" + TextLink "Log in" → `/login`. Success → `redirect("/verify-email")`. |
| `/login?next=` | redirect `safeNextPath(next)` | Heading "Log in". Email, Password (current-password). TextLink "Forgot password?" → `/forgot-password`. Button "Log in" / "Logging in…". Divider, GoogleButton "Continue with Google". "No account yet?" + "Create one" → `/register`. `?reset=1` → `Alert tone="success"` `passwordChanged`. `?error=` (Google failed) → `FormError` with `disabled` when the value contains `ACCOUNT_DISABLED` (case-insensitive), else `googleFailed`. Success → `redirect(safeNextPath(next))`. |
| `/forgot-password` | allowed | Heading "Reset your password". Email. Button "Send reset link" / "Sending…". After submit: `Alert tone="success"` `resetEmailSent` (always). |
| `/reset-password?token=` | allowed | Missing `token` (or `?error=INVALID_TOKEN`) → `Alert tone="danger"` `resetLinkInvalid` + TextLink "Ask for a new link" → `/forgot-password`. Else Heading "Choose a new password", fields New password, Confirm password, hidden token. Button "Change password" / "Saving…". Success → `redirect("/login?reset=1")`. |
| `/verify-email` | `requireUser()`; verified → redirect `/account` | Heading "Confirm your email". Text "We sent a confirmation link to <email>. Click it to verify your account. You need a verified email to buy themes." `ResendVerificationForm` (button "Send the email again" / "Sending…"; success → Alert success `verificationSent`). |
| `/account` | `requireUser()` | Temporary (replaced in a later task): Heading "Your account", Text "Hi <name>", Badge "Email verified" (success) or Alert warning "Please confirm your email address." + TextLink "Confirm email" → `/verify-email`. Badge "Admin" when `isAdmin`. |

- `GoogleButton` (`"use client"`): `Button variant="secondary" fullWidth`, onClick →
  `authClient.signIn.social({ provider: "google", callbackURL: <next or "/account">, errorCallbackURL: "/login" })`.
- `AccountMenu` (server component, prop `user: CurrentUser | null`): logged out → TextLink "Log in" (`/login`) +
  ButtonLink size sm "Sign up" (`/register`). Logged in → TextLink "Account" (`/account`) + a `<form action={logoutAction}>`
  with `Button size="sm" variant="ghost" type="submit"` "Log out". `logoutAction` → `redirect("/")`.
- Every action: auth check where needed (02 §5.5; register/login/forgot/reset need none; resend needs `requireUser`), zod,
  service in try/catch returning `ActionResult`, `redirect()` outside try/catch.

## Required tests

`src/features/auth/auth.service.test.ts` (real in-memory MongoDB; Better Auth runs for real; use `new Headers()`):
- [ ] registerUser › creates the user with country and default settings → user doc: `country "EG"`, `disabled false`, the 4 email switches `true`, `emailVerified false`
- [ ] registerUser › sends one verification email → `FakeEmailSender.sent` length 1, `to` = the email, `templateName "VerifyEmail"`, text contains `http://localhost:3000/`
- [ ] registerUser › refuses an email that is already used → CONFLICT `emailTaken`; still 1 user
- [ ] loginUser › creates a session for the right password → 1 doc in `session` for that user
- [ ] loginUser › refuses a wrong password → INVALID `wrongCredentials`; 0 sessions
- [ ] loginUser › refuses a disabled user → set `disabled: true` with `UserModel` in the test (factory rule); FORBIDDEN `disabled`; 0 sessions
- [ ] requestPasswordReset › sends a reset email for a known address and nothing for an unknown one → 1 email `ResetPasswordEmail`; then unknown email → still 1, no error
- [ ] resetPassword › refuses an invalid token → INVALID `resetLinkInvalid`

`src/features/users/user.service.test.ts`:
- [ ] setUserCountry › saves a valid code → `country "US"` in DB
- [ ] setUserCountry › refuses an unknown code → INVALID `invalidCountry` text; country unchanged
- [ ] isAdminEmail › matches case-insensitively → `"Admin@Example.com"` true; `"other@example.com"` false

`src/shared/lib/paths.test.ts`, `countries.test.ts`, `src/features/auth/auth.schemas.test.ts`:
- [ ] safeNextPath › keeps "/account/themes"; returns "/" for "//evil.com", "https://evil.com", "", null
- [ ] getCountryOptions › contains { value: "EG", label: "Egypt" } and is sorted by label
- [ ] registerSchema › lowercases the email and refuses country "XX" with `invalidCountry`
- [ ] resetPasswordSchema › refuses different passwords with `passwordsDiffer` on confirmPassword

`src/features/emails/email.service.test.ts`:
- [ ] sendVerifyEmail › sends subject "Confirm your email address" with the name and URL in both html and text

`e2e/auth.spec.ts` (needs MongoDB from docker compose; `EMAIL_TRANSPORT=console`):
- [ ] register → lands on "Confirm your email" → header shows "Log out" → log out → log in with a wrong password shows "Wrong email or password." → log in correctly → `/account` shows "Hi <name>"
- [ ] `/account` without session → redirected to `/login?next=%2Faccount`

Break check (≥ 3): remove the disabled hook; remove `setUserCountry` call; make `safeNextPath` accept "//". Each must make a test fail.

## Do NOT

- No other packages. No admin pages, no disable/enable actions (later task). No checkout country prompt (later task).
- Do not write to Better Auth core fields (`name`, `email`, `emailVerified`) with Mongoose.
- Do not log passwords, tokens, URLs from emails, or the Better Auth secret.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm build && pnpm e2e
```

Commit: `T-003: accounts and auth`
