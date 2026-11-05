import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    globalSetup: "src/shared/test/global-setup.ts",
    setupFiles: ["src/shared/test/setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    env: {
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      // MONGODB_URI is not set here: global-setup.ts sets it to the in-memory database.
      S3_ENDPOINT: "http://localhost:9000",
      S3_REGION: "us-east-1",
      S3_ACCESS_KEY_ID: "minioadmin",
      S3_SECRET_ACCESS_KEY: "minioadmin",
      S3_FORCE_PATH_STYLE: "true",
      S3_PRIVATE_BUCKET: "store-files",
      S3_PUBLIC_BUCKET: "store-images",
      PUBLIC_IMAGES_BASE_URL: "http://localhost:9000/store-images",
      BETTER_AUTH_SECRET: "dev-secret-change-me-dev-secret-change-me",
      BETTER_AUTH_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "dev-google-client-id",
      GOOGLE_CLIENT_SECRET: "dev-google-client-secret",
      ADMIN_EMAILS: "admin@example.com",
      EMAIL_TRANSPORT: "console",
      RESEND_API_KEY: "",
      EMAIL_FROM: "Theme Store <hello@example.com>",
      SUPPORT_EMAIL: "support@example.com",
    },
    coverage: {
      provider: "v8",
      include: [
        "src/features/**/*.service.ts",
        "src/features/**/*.mapper.ts",
        "src/features/**/*.schemas.ts",
        "src/shared/lib/**",
      ],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 80, branches: 80 },
    },
  },
});
