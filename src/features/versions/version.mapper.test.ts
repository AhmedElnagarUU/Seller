import { describe, expect, it } from "vitest";
import { toVersionAdminDTO, toVersionDTO } from "@/features/versions/version.mapper";
import { createTheme, createVersion } from "@/shared/test/factories";

const RELEASED_AT = new Date("2026-03-01T10:00:00Z");

async function buildVersion() {
  const theme = await createTheme();
  return createVersion(theme._id.toString(), {
    version: "1.2.0",
    changes: [
      { type: "new", text: "Added dark mode" },
      { type: "fixed", text: "Fixed the menu" },
    ],
    file: {
      key: "theme-zips/abc/0000000000000001.zip",
      sizeBytes: 2048,
      sha256: "b".repeat(64),
      originalName: "aurora.zip",
    },
    releasedAt: RELEASED_AT,
    notifyRequested: true,
  });
}

describe("toVersionDTO", () => {
  it("has no file key and no hash", async () => {
    const record = await buildVersion();

    const dto = toVersionDTO(record);

    expect(Object.keys(dto).sort()).toEqual(["changes", "id", "releasedAt", "sizeBytes", "version"]);
    expect(dto).toEqual({
      id: record._id.toString(),
      version: "1.2.0",
      releasedAt: RELEASED_AT,
      changes: [
        { type: "new", text: "Added dark mode" },
        { type: "fixed", text: "Fixed the menu" },
      ],
      sizeBytes: 2048,
    });
  });
});

describe("toVersionAdminDTO", () => {
  it("has the hash, original name and notify flag", async () => {
    const record = await buildVersion();

    const dto = toVersionAdminDTO(record);

    expect(dto.sha256).toBe("b".repeat(64));
    expect(dto.originalName).toBe("aurora.zip");
    expect(dto.notifyRequested).toBe(true);
    expect(Object.keys(dto).sort()).toEqual([
      "changes",
      "id",
      "notifyRequested",
      "originalName",
      "releasedAt",
      "sha256",
      "sizeBytes",
      "version",
    ]);
  });
});
