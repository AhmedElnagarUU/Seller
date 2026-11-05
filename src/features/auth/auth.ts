import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/shared/config/env";
import { getMongoClient } from "@/shared/db/mongo-client";
import { sendResetPasswordEmail, sendVerifyEmail } from "@/features/emails/email.service";
import { isUserDisabled } from "@/features/users/user.service";

// The Better Auth instance (docs/02-architecture.md section 8). Extra user fields: docs/03-data-model.md section 3.
export const auth = betterAuth({
  appName: "Theme Store",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: mongodbAdapter(getMongoClient().db(), { client: getMongoClient() }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: false, // D-023: the email must be verified only before buying
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => sendResetPasswordEmail({ to: user.email, name: user.name, url }),
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 86400,
    sendVerificationEmail: async ({ user, url }) => sendVerifyEmail({ to: user.email, name: user.name, url }),
  },
  socialProviders: {
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  },
  user: {
    additionalFields: {
      country: { type: "string", required: false, input: false },
      disabled: { type: "boolean", required: false, defaultValue: false, input: false },
      disabledReason: { type: "string", required: false, input: false },
      disabledAt: { type: "date", required: false, input: false },
      emailOwnedThemeUpdates: { type: "boolean", required: false, defaultValue: true, input: false },
      emailFavoriteThemeUpdates: { type: "boolean", required: false, defaultValue: true, input: false },
      emailFollowedCategoryThemes: { type: "boolean", required: false, defaultValue: true, input: false },
      emailAnnouncements: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          if (await isUserDisabled(session.userId)) throw new APIError("FORBIDDEN", { message: "ACCOUNT_DISABLED" });
        },
      },
    },
  },
  plugins: [nextCookies()], // must be last
});
