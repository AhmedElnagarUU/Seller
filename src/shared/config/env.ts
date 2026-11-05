import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

// Comma-separated list: each item is trimmed, lowercased and must be a valid email. At least one.
const adminEmails = z
  .string()
  .transform((value) => value.split(",").map((email) => email.trim().toLowerCase()))
  .pipe(z.array(z.email()).min(1));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "ci", "staging", "production"]).default("local"),
  APP_URL: z.url().refine((value) => !value.endsWith("/"), "must not end with a slash"),
  MONGODB_URI: z.string().startsWith("mongodb"),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanString,
  S3_PRIVATE_BUCKET: z.string().min(1),
  S3_PUBLIC_BUCKET: z.string().min(1),
  PUBLIC_IMAGES_BASE_URL: z.url().refine((value) => !value.endsWith("/"), "must not end with a slash"),
  ENABLE_DEV_PAGES: booleanString.default(false),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().refine((value) => !value.endsWith("/"), "must not end with a slash"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  ADMIN_EMAILS: adminEmails,
  EMAIL_TRANSPORT: z.enum(["resend", "console"]),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(1),
  SUPPORT_EMAIL: z.email(),
});

const envSchemaWithRules = envSchema.superRefine((value, context) => {
  if (value.EMAIL_TRANSPORT === "console" && value.APP_ENV === "production") {
    context.addIssue({
      code: "custom",
      path: ["EMAIL_TRANSPORT"],
      message: "EMAIL_TRANSPORT=console is not allowed when APP_ENV=production",
    });
  }
  if (value.EMAIL_TRANSPORT === "resend" && !value.RESEND_API_KEY) {
    context.addIssue({
      code: "custom",
      path: ["RESEND_API_KEY"],
      message: "RESEND_API_KEY is required when EMAIL_TRANSPORT=resend",
    });
  }
});

export type Env = z.infer<typeof envSchemaWithRules>;

function parseEnv(): Env {
  const result = envSchemaWithRules.safeParse(process.env);
  if (result.success) return result.data;
  const invalidNames = Object.keys(z.flattenError(result.error).fieldErrors);
  throw new Error(`Invalid or missing environment variables: ${invalidNames.join(", ")}`);
}

export const env: Env = parseEnv();
