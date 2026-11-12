import { crc32, deflateSync } from "node:zlib";
import mongoose from "mongoose";
import { expect, type Page } from "@playwright/test";

// Shared by every e2e file. All files use the one admin account, so they never run at the same time
// (`workers: 1` in playwright.config.ts).
export const ADMIN_EMAIL = "admin@example.com";
export const PASSWORD = "password123";

export function readMongoUri(): string {
  if (!process.env.MONGODB_URI) process.loadEnvFile(".env");
  return process.env.MONGODB_URI ?? "";
}

export async function registerAs(page: Page, email: string): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Person");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("Country").selectOption("EG");
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
