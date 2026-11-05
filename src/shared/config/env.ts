import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (result.success) return result.data;
  const invalidNames = Object.keys(z.flattenError(result.error).fieldErrors);
  throw new Error(`Invalid or missing environment variables: ${invalidNames.join(", ")}`);
}

export const env: Env = parseEnv();
