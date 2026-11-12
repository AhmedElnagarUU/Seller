import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { DownloadLogModel } from "@/features/downloads/download-log.model";
import { createDownloadLink } from "@/features/downloads/download.service";
import { ThemeModel } from "@/features/themes/theme.model";
import { setTestNow } from "@/shared/lib/clock";
import { fakeStorage } from "@/shared/test/fakes/fake-storage";
import { createOwnership, createTheme, createUser, createVersion } from "@/shared/test/factories";

const FIXED_NOW = new Date("2026-11-01T10:00:00Z");
const FORBIDDEN_MESSAGE = "You do not own this theme.";
const NOT_FOUND_MESSAGE = "This file does not exist.";
const RATE_LIMITED_MESSAGE = "You downloaded too many files in the last hour. Please try again later.";
const UNKNOWN_ID = "665f1c2e8f1b2c3d4e5f6a7b";
const MINUTE = 60_000;

// A user with an active ownership of a theme "aurora-blog" that has the version 1.2.0.
async function setup(themeStatus: "published" | "unpublished" = "published") {
  setTestNow(FIXED_NOW);
  const user = await createUser();
  const theme = await createTheme({ name: "Aurora Blog", slug: "aurora-blog", status: themeStatus });
  const version = await createVersion(theme._id.toString(), { version: "1.2.0" });
  await createOwnership(user._id.toString(), theme._id.toString());
  return { userId: user._id.toString(), themeId: theme._id.toString(), version, versionId: version._id.toString() };
}

async function downloadCountOf(themeId: string): Promise<number | undefined> {
  const theme = await ThemeModel.findById(themeId).lean();
  return theme?.stats.downloadCount;
}

async function insertLogs(userId: string, themeId: string, versionId: string, count: number): Promise<void> {
  const logs = Array.from({ length: count }, () => ({
    userId: new Types.ObjectId(userId),
    themeId: new Types.ObjectId(themeId),
    versionId: new Types.ObjectId(versionId),
    createdAt: FIXED_NOW,
  }));
  await DownloadLogModel.insertMany(logs);
}

describe("createDownloadLink", () => {
  it("refuses a user without ownership", async () => {
    const { themeId, versionId } = await setup();
    const stranger = await createUser();

    await expect(createDownloadLink({ userId: stranger._id.toString(), versionId })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: FORBIDDEN_MESSAGE,
    });

    expect(await DownloadLogModel.countDocuments()).toBe(0);
    expect(await downloadCountOf(themeId)).toBe(0);
  });

  it("refuses a revoked ownership", async () => {
    setTestNow(FIXED_NOW);
    const user = await createUser();
    const theme = await createTheme();
    const version = await createVersion(theme._id.toString());
    await createOwnership(user._id.toString(), theme._id.toString(), {
      status: "revoked",
      revokedAt: FIXED_NOW,
      revokedReason: "admin",
      revokedByUserId: new Types.ObjectId(),
      revokeNote: "Chargeback",
    });

    await expect(
      createDownloadLink({ userId: user._id.toString(), versionId: version._id.toString() }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: FORBIDDEN_MESSAGE });

    expect(await DownloadLogModel.countDocuments()).toBe(0);
  });

  it("refuses the ownership of another user", async () => {
    const { versionId } = await setup();
    const otherUser = await createUser();

    await expect(createDownloadLink({ userId: otherUser._id.toString(), versionId })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: FORBIDDEN_MESSAGE,
    });
  });

  it("allows an owner of an unpublished theme", async () => {
    const { userId, versionId } = await setup("unpublished");

    const result = await createDownloadLink({ userId, versionId });

    expect(result.url).toContain("aurora-blog-1.2.0.zip");
    expect(await DownloadLogModel.countDocuments()).toBe(1);
  });

  it("refuses an unknown version id", async () => {
    const { userId } = await setup();

    await expect(createDownloadLink({ userId, versionId: UNKNOWN_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: NOT_FOUND_MESSAGE,
    });

    expect(await DownloadLogModel.countDocuments()).toBe(0);
  });

  it("refuses an invalid version id", async () => {
    const { userId } = await setup();

    await expect(createDownloadLink({ userId, versionId: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: NOT_FOUND_MESSAGE,
    });

    expect(await DownloadLogModel.countDocuments()).toBe(0);
  });

  it("refuses the 31st download within 60 minutes", async () => {
    const { userId, themeId, versionId } = await setup();
    await insertLogs(userId, themeId, versionId, 30);

    await expect(createDownloadLink({ userId, versionId })).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: RATE_LIMITED_MESSAGE,
    });

    expect(await DownloadLogModel.countDocuments()).toBe(30);
    expect(await downloadCountOf(themeId)).toBe(0);
  });

  it("the limit is per user", async () => {
    const { userId, themeId, versionId } = await setup();
    const otherUser = await createUser();
    await createOwnership(otherUser._id.toString(), themeId);
    await insertLogs(userId, themeId, versionId, 30);

    const result = await createDownloadLink({ userId: otherUser._id.toString(), versionId });

    expect(result.url).toContain("aurora-blog-1.2.0.zip");
    expect(await DownloadLogModel.countDocuments({ userId: otherUser._id })).toBe(1);
  });

  it("allows a download 61 minutes after 30 others", async () => {
    const { userId, themeId, versionId } = await setup();
    await insertLogs(userId, themeId, versionId, 30);
    setTestNow(new Date(FIXED_NOW.getTime() + 61 * MINUTE));

    const result = await createDownloadLink({ userId, versionId });

    expect(result.url).toContain("aurora-blog-1.2.0.zip");
    expect(await DownloadLogModel.countDocuments()).toBe(31);
  });

  it("logs the download and counts it", async () => {
    const { userId, themeId, version, versionId } = await setup();

    const result = await createDownloadLink({ userId, versionId });

    const logs = await DownloadLogModel.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.userId.toString()).toBe(userId);
    expect(logs[0]?.themeId.toString()).toBe(themeId);
    expect(logs[0]?.versionId.toString()).toBe(versionId);
    expect(logs[0]?.createdAt).toEqual(FIXED_NOW);
    expect(await downloadCountOf(themeId)).toBe(1);
    expect(result.url).toContain(encodeURIComponent(version.file.key).replaceAll("%2F", "/"));
    expect(result.url).toContain(encodeURIComponent("aurora-blog-1.2.0.zip"));
    expect(fakeStorage.downloadUrlRequests).toEqual([
      { key: version.file.key, expiresInSeconds: 300, downloadFileName: "aurora-blog-1.2.0.zip" },
    ]);
  });
});
