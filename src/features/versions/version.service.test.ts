import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { beforeAll, describe, expect, it } from "vitest";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { NotificationJobModel } from "@/features/notifications/notification-job.model";
import { ThemeModel } from "@/features/themes/theme.model";
import { VersionModel } from "@/features/versions/version.model";
import type { CreateVersionInput } from "@/features/versions/version.schemas";
import {
  countVersionsForTheme,
  createVersion,
  createZipUploadUrl,
  getVersionForAdmin,
  getVersionForDownload,
  listVersionsForAdmin,
  listVersionsForTheme,
  updateVersionChanges,
} from "@/features/versions/version.service";
import { setTestNow } from "@/shared/lib/clock";
import { fakeStorage } from "@/shared/test/fakes/fake-storage";
import { createAdmin, createTheme, createVersion as createVersionRow } from "@/shared/test/factories";

const THEME_NOT_FOUND = "Theme not found.";
const INVALID_ZIP = "Please choose a .zip file of at most 200 MB.";
const FILE_NOT_FOUND = "We could not find the uploaded file. Please upload it again.";
const FILE_ALREADY_USED = "This file is already used by another version. Please upload it again.";
const NOT_A_ZIP = "This file is not a valid .zip file.";
const UNKNOWN_ID = "665f1c2e8f1b2c3d4e5f6a7b";
const ZIP_BODY = Buffer.concat([Buffer.from("504b0304", "hex"), Buffer.from("rest of the file")]);
const FIXED_NOW = new Date("2026-06-15T12:00:00Z");

beforeAll(async () => {
  // The unique indexes must exist before a test relies on them (a transaction may create the collection).
  await VersionModel.init();
});

// Stores a file as if the browser had uploaded it for this theme. Returns its key.
function putZip(themeId: string, body: Buffer = ZIP_BODY, name = "0123456789abcdef"): string {
  const key = `theme-zips/${themeId}/${name}.zip`;
  fakeStorage.putTestObject({ bucket: "private", key, contentType: "application/zip", body });
  return key;
}

function buildInput(themeId: string, fileKey: string, overrides: Partial<CreateVersionInput> = {}): CreateVersionInput {
  return {
    themeId,
    version: "1.0.0",
    changes: [{ type: "new", text: "First release" }],
    notify: false,
    fileKey,
    originalName: "aurora.zip",
    ...overrides,
  };
}

async function setLatest(themeId: string, versionId: Types.ObjectId, version: string): Promise<void> {
  await ThemeModel.updateOne(
    { _id: themeId },
    { $set: { latestVersion: { versionId, version, releasedAt: new Date("2026-01-01T00:00:00Z") } } },
  );
}

describe("createZipUploadUrl", () => {
  it("refuses a file not ending in .zip and a file over 209 715 200 bytes", async () => {
    const theme = await createTheme();
    const themeId = theme._id.toString();

    await expect(createZipUploadUrl({ themeId, fileName: "theme.rar", sizeBytes: 1000 })).rejects.toMatchObject({
      code: "INVALID",
      message: INVALID_ZIP,
    });
    await expect(createZipUploadUrl({ themeId, fileName: "theme.zip", sizeBytes: 209715201 })).rejects.toMatchObject({
      code: "INVALID",
      message: INVALID_ZIP,
    });
    await expect(createZipUploadUrl({ themeId, fileName: "theme.zip", sizeBytes: 0 })).rejects.toMatchObject({
      code: "INVALID",
      message: INVALID_ZIP,
    });
    expect(fakeStorage.uploadUrlRequests).toEqual([]);
  });

  it("accepts an upper-case extension and uses our own content type", async () => {
    const theme = await createTheme();
    const themeId = theme._id.toString();

    const result = await createZipUploadUrl({ themeId, fileName: "THEME.ZIP", sizeBytes: 5000 });

    expect(fakeStorage.uploadUrlRequests).toEqual([
      {
        bucket: "private",
        key: result.key,
        contentType: "application/zip",
        sizeBytes: 5000,
        cacheControl: null,
        expiresInSeconds: 1800,
      },
    ]);
    expect(result.key).toMatch(new RegExp(`^theme-zips/${themeId}/[0-9a-f]{16}\\.zip$`));
  });

  it("refuses an unknown theme", async () => {
    await expect(
      createZipUploadUrl({ themeId: UNKNOWN_ID, fileName: "theme.zip", sizeBytes: 1000 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: THEME_NOT_FOUND });
    expect(fakeStorage.uploadUrlRequests).toEqual([]);
  });
});

describe("createVersion", () => {
  it("refuses a version that is not higher than the latest", async () => {
    const admin = await createAdmin();
    const theme = await createTheme({ name: "Aurora" });
    const themeId = theme._id.toString();
    const existing = await createVersionRow(themeId, { version: "1.4.0" });
    await setLatest(themeId, existing._id, "1.4.0");
    const fileKey = putZip(themeId);

    for (const version of ["1.4.0", "1.3.9"]) {
      await expect(
        createVersion(buildInput(themeId, fileKey, { version }), admin._id.toString()),
      ).rejects.toMatchObject({ code: "CONFLICT", message: "The version must be higher than 1.4.0." });
    }

    expect(await VersionModel.countDocuments()).toBe(1);
    expect(await NotificationJobModel.countDocuments()).toBe(0);
    expect(await ActivityLogModel.countDocuments()).toBe(0);
    const saved = await ThemeModel.findById(themeId).lean();
    expect(saved?.latestVersion?.version).toBe("1.4.0");
  });

  it("accepts 1.10.0 after 1.9.0", async () => {
    const admin = await createAdmin();
    const theme = await createTheme();
    const themeId = theme._id.toString();
    const existing = await createVersionRow(themeId, { version: "1.9.0" });
    await setLatest(themeId, existing._id, "1.9.0");

    const created = await createVersion(
      buildInput(themeId, putZip(themeId), { version: "1.10.0" }),
      admin._id.toString(),
    );

    expect(created.version).toBe("1.10.0");
    const saved = await ThemeModel.findById(themeId).lean();
    expect(saved?.latestVersion?.version).toBe("1.10.0");
    expect(await VersionModel.countDocuments()).toBe(2);
  });

  it("accepts the first version of a theme", async () => {
    const admin = await createAdmin();
    const theme = await createTheme();
    const themeId = theme._id.toString();
    expect(theme.latestVersion).toBeNull();

    await createVersion(buildInput(themeId, putZip(themeId)), admin._id.toString());

    const versions = await VersionModel.find().lean();
    expect(versions).toHaveLength(1);
    expect(versions[0]?.version).toBe("1.0.0");
    expect(versions[0]?.themeId.toString()).toBe(themeId);
  });

  it("refuses a file key of another theme", async () => {
    const admin = await createAdmin();
    const theme = await createTheme();
    const otherTheme = await createTheme();
    const fileKey = putZip(otherTheme._id.toString());

    await expect(createVersion(buildInput(theme._id.toString(), fileKey), admin._id.toString())).rejects.toMatchObject({
      code: "INVALID",
      message: FILE_NOT_FOUND,
    });
    expect(await VersionModel.countDocuments()).toBe(0);
  });

  it("refuses a file that is not in storage", async () => {
    const admin = await createAdmin();
    const theme = await createTheme();
    const themeId = theme._id.toString();

    await expect(
      createVersion(buildInput(themeId, `theme-zips/${themeId}/missing000000000.zip`), admin._id.toString()),
    ).rejects.toMatchObject({ code: "INVALID", message: FILE_NOT_FOUND });
    expect(await VersionModel.countDocuments()).toBe(0);
  });

  it("refuses an empty file and deletes it", async () => {
    const admin = await createAdmin();
    const theme = await createTheme();
    const themeId = theme._id.toString();
    const fileKey = putZip(themeId, Buffer.alloc(0));
    expect(fakeStorage.objects.has(`private/${fileKey}`)).toBe(true);

    await expect(createVersion(buildInput(themeId, fileKey), admin._id.toString())).rejects.toMatchObject({
      code: "INVALID",
      message: INVALID_ZIP,
    });

    expect(fakeStorage.objects.has(`private/${fileKey}`)).toBe(false);
    expect(await VersionModel.countDocuments()).toBe(0);
  });

  it("deletes and refuses a file that does not start with the zip signature", async () => {
    const admin = await createAdmin();
    const theme = await createTheme();
    const themeId = theme._id.toString();
    const fileKey = putZip(themeId, Buffer.from("this is plain text, not a zip"));

    await expect(createVersion(buildInput(themeId, fileKey), admin._id.toString())).rejects.toMatchObject({
      code: "INVALID",
      message: NOT_A_ZIP,
    });

    expect(fakeStorage.objects.has(`private/${fileKey}`)).toBe(false);
    expect(await VersionModel.countDocuments()).toBe(0);
    const saved = await ThemeModel.findById(themeId).lean();
    expect(saved?.latestVersion).toBeNull();
  });

  it("stores the real SHA-256 and size of the uploaded file", async () => {
    setTestNow(FIXED_NOW);
    const admin = await createAdmin();
    const theme = await createTheme();
    const themeId = theme._id.toString();
    const body = Buffer.concat([ZIP_BODY, Buffer.from(" with more bytes")]);

    await createVersion(
      buildInput(themeId, putZip(themeId, body), { originalName: "my-theme.zip" }),
      admin._id.toString(),
    );

    const saved = await VersionModel.findOne().lean();
    expect(saved?.file.sha256).toBe(createHash("sha256").update(body).digest("hex"));
    expect(saved?.file.sizeBytes).toBe(body.length);
    expect(saved?.file.originalName).toBe("my-theme.zip");
    expect(saved?.releasedAt).toEqual(FIXED_NOW);
  });

  it("updates the theme and logs version_released", async () => {
    setTestNow(FIXED_NOW);
    const admin = await createAdmin();
    const theme = await createTheme({ name: "Aurora Blog" });
    const themeId = theme._id.toString();

    const created = await createVersion(
      buildInput(themeId, putZip(themeId), { version: "1.5.0" }),
      admin._id.toString(),
    );

    const saved = await ThemeModel.findById(themeId).lean();
    expect(saved?.latestVersion?.versionId.toString()).toBe(created.id);
    expect(saved?.latestVersion?.version).toBe("1.5.0");
    expect(saved?.latestVersion?.releasedAt).toEqual(FIXED_NOW);
    const logs = await ActivityLogModel.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("version_released");
    expect(logs[0]?.actorRole).toBe("admin");
    expect(logs[0]?.actorUserId?.toString()).toBe(admin._id.toString());
    expect(logs[0]?.targetType).toBe("theme");
    expect(logs[0]?.targetId?.toString()).toBe(themeId);
    expect(logs[0]?.summary).toBe("Version released: Aurora Blog 1.5.0");
  });

  it("with notify creates one version_released job and sets notificationJobId", async () => {
    const admin = await createAdmin();
    const theme = await createTheme();
    const themeId = theme._id.toString();

    const created = await createVersion(buildInput(themeId, putZip(themeId), { notify: true }), admin._id.toString());

    const jobs = await NotificationJobModel.find().lean();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.kind).toBe("version_released");
    expect(jobs[0]?.stage).toBe("theme_owners");
    expect(jobs[0]?.themeId?.toString()).toBe(themeId);
    expect(jobs[0]?.versionId?.toString()).toBe(created.id);
    expect(jobs[0]?.createdByUserId.toString()).toBe(admin._id.toString());
    const saved = await VersionModel.findById(created.id).lean();
    expect(saved?.notificationJobId?.toString()).toBe(jobs[0]?._id.toString());
    expect(saved?.notifyRequested).toBe(true);
  });

  it("without notify creates no job", async () => {
    const admin = await createAdmin();
    const theme = await createTheme();
    const themeId = theme._id.toString();

    const created = await createVersion(buildInput(themeId, putZip(themeId), { notify: false }), admin._id.toString());

    expect(await NotificationJobModel.countDocuments()).toBe(0);
    const saved = await VersionModel.findById(created.id).lean();
    expect(saved?.notificationJobId).toBeNull();
    expect(saved?.notifyRequested).toBe(false);
  });

  it("refuses a file key already used by another version", async () => {
    const admin = await createAdmin();
    const theme = await createTheme();
    const themeId = theme._id.toString();
    const fileKey = putZip(themeId);
    await createVersionRow(themeId, {
      file: { key: fileKey, sizeBytes: 1000, sha256: "a".repeat(64), originalName: "a.zip" },
    });

    await expect(
      createVersion(buildInput(themeId, fileKey, { version: "2.0.0" }), admin._id.toString()),
    ).rejects.toMatchObject({ code: "CONFLICT", message: FILE_ALREADY_USED });

    expect(await VersionModel.countDocuments()).toBe(1);
    expect(fakeStorage.objects.has(`private/${fileKey}`)).toBe(true);
  });

  it("refuses a version number that already exists for the theme", async () => {
    const admin = await createAdmin();
    const theme = await createTheme();
    const themeId = theme._id.toString();
    await createVersionRow(themeId, { version: "1.0.0" });

    await expect(createVersion(buildInput(themeId, putZip(themeId)), admin._id.toString())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Version 1.0.0 already exists for this theme.",
    });

    expect(await VersionModel.countDocuments()).toBe(1);
    expect(await NotificationJobModel.countDocuments()).toBe(0);
    expect(await ActivityLogModel.countDocuments()).toBe(0);
    const saved = await ThemeModel.findById(themeId).lean();
    expect(saved?.latestVersion).toBeNull();
  });

  it("refuses an unknown theme", async () => {
    const admin = await createAdmin();

    await expect(createVersion(buildInput(UNKNOWN_ID, putZip(UNKNOWN_ID)), admin._id.toString())).rejects.toMatchObject(
      { code: "NOT_FOUND", message: THEME_NOT_FOUND },
    );
  });
});

describe("updateVersionChanges", () => {
  it("changes only changes", async () => {
    const theme = await createTheme();
    const themeId = theme._id.toString();
    const before = await createVersionRow(themeId, { version: "1.2.0", notifyRequested: true });

    await updateVersionChanges({
      versionId: before._id.toString(),
      changes: [{ type: "fixed", text: "Fixed the menu" }],
    });

    const after = await VersionModel.findById(before._id).lean();
    expect(after?.changes).toEqual([{ type: "fixed", text: "Fixed the menu" }]);
    expect(after?.version).toBe("1.2.0");
    expect(after?.file).toEqual(before.file);
    expect(after?.releasedAt).toEqual(before.releasedAt);
    expect(after?.notifyRequested).toBe(true);
    expect(await NotificationJobModel.countDocuments()).toBe(0);
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("refuses an unknown or invalid version id", async () => {
    const changes = [{ type: "new" as const, text: "Added dark mode" }];

    await expect(updateVersionChanges({ versionId: new Types.ObjectId().toString(), changes })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Version not found.",
    });
    await expect(updateVersionChanges({ versionId: "nope", changes })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Version not found.",
    });
  });
});

describe("listVersionsForTheme", () => {
  it("returns the newest first without file data", async () => {
    const theme = await createTheme();
    const themeId = theme._id.toString();
    await createVersionRow(themeId, { version: "1.1.0", releasedAt: new Date("2026-02-01T00:00:00Z") });
    await createVersionRow(themeId, { version: "1.3.0", releasedAt: new Date("2026-04-01T00:00:00Z") });
    await createVersionRow(themeId, { version: "1.2.0", releasedAt: new Date("2026-03-01T00:00:00Z") });
    const otherTheme = await createTheme();
    await createVersionRow(otherTheme._id.toString(), { version: "9.0.0" });

    const versions = await listVersionsForTheme(themeId);

    expect(versions.map((version) => version.version)).toEqual(["1.3.0", "1.2.0", "1.1.0"]);
    for (const version of versions) {
      expect(Object.keys(version).sort()).toEqual(["changes", "id", "releasedAt", "sizeBytes", "version"]);
    }
    expect(await countVersionsForTheme(themeId)).toBe(3);
  });
});

describe("getVersionForDownload", () => {
  it("returns the file key, and null for an unknown or invalid id", async () => {
    const theme = await createTheme();
    const themeId = theme._id.toString();
    const row = await createVersionRow(themeId, { version: "1.7.0" });

    const found = await getVersionForDownload(row._id.toString());

    expect(found).toEqual({ id: row._id.toString(), themeId, version: "1.7.0", fileKey: row.file.key });
    expect(await getVersionForDownload(UNKNOWN_ID)).toBeNull();
    expect(await getVersionForDownload("nope")).toBeNull();
  });
});

describe("listVersionsForAdmin", () => {
  it("includes the notification summary", async () => {
    const admin = await createAdmin();
    const theme = await createTheme();
    const themeId = theme._id.toString();
    const withJob = await createVersion(buildInput(themeId, putZip(themeId), { notify: true }), admin._id.toString());
    const withoutJob = await createVersion(
      buildInput(themeId, putZip(themeId, ZIP_BODY, "fedcba9876543210"), { version: "1.0.1" }),
      admin._id.toString(),
    );

    const versions = await listVersionsForAdmin(themeId);

    const first = versions.find((version) => version.id === withJob.id);
    const second = versions.find((version) => version.id === withoutJob.id);
    expect(first?.notification).toMatchObject({ status: "pending", notifiedCount: 0, emailedCount: 0, error: null });
    expect(second?.notification).toBeNull();
    expect(first?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("getVersionForAdmin", () => {
  it("returns null for a version of another theme", async () => {
    const theme = await createTheme();
    const otherTheme = await createTheme();
    const row = await createVersionRow(theme._id.toString());

    expect((await getVersionForAdmin(theme._id.toString(), row._id.toString()))?.id).toBe(row._id.toString());
    expect(await getVersionForAdmin(otherTheme._id.toString(), row._id.toString())).toBeNull();
  });
});
