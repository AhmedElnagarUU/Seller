import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { crc32, deflateSync } from "node:zlib";
import mongoose from "mongoose";
import { expect, type Page } from "@playwright/test";
import { CategoryModel } from "@/features/categories/category.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { VersionModel } from "@/features/versions/version.model";

// Shared by every e2e file. All files use the one admin account, so they never run at the same time
// (`workers: 1` in playwright.config.ts).
export const ADMIN_EMAIL = "admin@example.com";
export const PASSWORD = "password123";

export function readMongoUri(): string {
  if (!process.env.MONGODB_URI) process.loadEnvFile(".env");
  return process.env.MONGODB_URI ?? "";
}

// `country` is the value of the Country select ("EG" is Egypt).
export async function registerAs(page: Page, email: string, country: string = "EG"): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Person");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("Country").selectOption(country);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Confirm your email" })).toBeVisible();
}

// A fresh admin account for every run: the old one (with its login data) is removed first.
// Needs an open mongoose connection.
export async function removeAdminAccount(): Promise<void> {
  const database = mongoose.connection.db;
  if (!database) return;
  const existing = await database.collection("user").findOne({ email: ADMIN_EMAIL });
  if (!existing) return;
  await database.collection("account").deleteMany({ userId: existing._id.toString() });
  await database.collection("session").deleteMany({ userId: existing._id.toString() });
  await database.collection("user").deleteOne({ _id: existing._id });
}

// Logs in a user that already exists.
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("/");
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

// A plain white PNG of the given size: a real image that the browser can decode.
export function createPngFile(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 255)]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const DOS_DATE_1980_01_01 = 33;

// A real .zip file with one stored (not compressed) file inside.
export function createZipFile(fileName: string, content: string): Buffer {
  const name = Buffer.from(fileName, "utf8");
  const data = Buffer.from(content, "utf8");
  const checksum = crc32(data);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4); // version needed
  localHeader.writeUInt16LE(0, 6); // flags
  localHeader.writeUInt16LE(0, 8); // method: stored
  localHeader.writeUInt16LE(0, 10); // time
  localHeader.writeUInt16LE(DOS_DATE_1980_01_01, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(data.length, 18); // compressed size
  localHeader.writeUInt32LE(data.length, 22); // size
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28); // extra length
  const localPart = Buffer.concat([localHeader, name, data]);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4); // version made by
  centralHeader.writeUInt16LE(20, 6); // version needed
  centralHeader.writeUInt16LE(0, 8); // flags
  centralHeader.writeUInt16LE(0, 10); // method
  centralHeader.writeUInt16LE(0, 12); // time
  centralHeader.writeUInt16LE(DOS_DATE_1980_01_01, 14);
  centralHeader.writeUInt32LE(checksum, 16);
  centralHeader.writeUInt32LE(data.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(name.length, 28);
  centralHeader.writeUInt32LE(0, 42); // offset of the local header
  const centralPart = Buffer.concat([centralHeader, name]);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8); // entries on this disk
  end.writeUInt16LE(1, 10); // entries in total
  end.writeUInt32LE(centralPart.length, 12);
  end.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, end]);
}

// Uploads a real file to the local MinIO with the same presigned URL the app creates.
export async function putStoredFile(input: {
  bucket: "private" | "public";
  key: string;
  contentType: string;
  body: Buffer;
}): Promise<void> {
  if (!process.env.S3_ENDPOINT) process.loadEnvFile(".env");
  // `import()` does not resolve the "@/" paths inside s3.ts under Playwright, so this loads it with `require`.
  const { createUploadUrl } = createRequire(__filename)("@/shared/storage/s3") as typeof import("@/shared/storage/s3");
  const upload = await createUploadUrl({
    bucket: input.bucket,
    key: input.key,
    contentType: input.contentType,
    sizeBytes: input.body.length,
    cacheControl: null,
    expiresInSeconds: 600,
  });
  const response = await fetch(upload.url, {
    method: "PUT",
    headers: upload.headers,
    body: new Uint8Array(input.body),
  });
  if (!response.ok) throw new Error(`Could not upload the test file (${response.status}).`);
}

// New users are not verified, and the checkout needs a verified user. Better Auth's cookie cache is off, so the
// change works at once. Needs an open mongoose connection.
export async function markEmailVerified(email: string): Promise<void> {
  await mongoose.connection.db?.collection("user").updateOne({ email }, { $set: { emailVerified: true } });
}

// A category and a published theme with one real version (1.0.0) and its zip in the private bucket.
// Needs an open mongoose connection. The caller removes the rows again.
export async function seedPublishedThemeWithZip(input: { runId: string; priceCents: number }): Promise<{
  themeId: string;
  slug: string;
  name: string;
  zipBody: Buffer;
}> {
  const slug = `e2e-${input.runId}`;
  const name = `E2E Theme ${input.runId}`;
  const category = await CategoryModel.create({
    name: `E2E Category ${input.runId}`,
    slug: `e2e-category-${input.runId}`,
  });
  const theme = await ThemeModel.create({
    name,
    slug,
    status: "published",
    publishedAt: new Date(),
    tagline: "A calm theme for writers and bloggers",
    description: "A longer description of this theme. It has more than fifty characters in it.",
    categoryId: category._id,
    priceCents: input.priceCents,
    requirements: { wordpressMin: "6.4", phpMin: "8.1", testedUpTo: "6.8" },
    provider: { productId: "fake_prod_" + input.runId, syncedAt: new Date() },
  });
  const themeId = theme._id.toString();
  const zipBody = createZipFile("a/style.css", "1.0.0 " + input.runId);
  const key = `theme-zips/${themeId}/${randomBytes(8).toString("hex")}.zip`;
  await putStoredFile({ bucket: "private", key, contentType: "application/zip", body: zipBody });
  const releasedAt = new Date();
  const version = await VersionModel.create({
    themeId,
    version: "1.0.0",
    changes: [{ type: "new", text: "First release" }],
    file: {
      key,
      sizeBytes: zipBody.length,
      sha256: createHash("sha256").update(zipBody).digest("hex"),
      originalName: "theme.zip",
    },
    releasedAt,
    notifyRequested: false,
    notificationJobId: null,
  });
  await ThemeModel.updateOne(
    { _id: themeId },
    { $set: { latestVersion: { versionId: version._id, version: "1.0.0", releasedAt } } },
  );
  return { themeId, slug, name, zipBody };
}
