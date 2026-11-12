import { Types } from "mongoose";
import { beforeAll, describe, expect, it } from "vitest";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { OwnershipModel } from "@/features/ownerships/ownership.model";
import {
  grantByAdmin,
  grantFromOrder,
  hasActiveOwnership,
  listOwnedThemes,
  revokeByAdmin,
  revokeForRefund,
} from "@/features/ownerships/ownership.service";
import { withTransaction } from "@/shared/db/transaction";
import { setTestNow } from "@/shared/lib/clock";
import { createAdmin, createOwnership, createTheme, createUser, createVersion } from "@/shared/test/factories";

const FIXED_NOW = new Date("2026-11-01T10:00:00Z");
const EARLIER = new Date("2026-10-01T10:00:00Z");
const UNKNOWN_ID = "665f1c2e8f1b2c3d4e5f6a7b";

beforeAll(async () => {
  // The unique index must exist before a transaction writes to the collection.
  await OwnershipModel.init();
});

function newOrderId(): string {
  return new Types.ObjectId().toString();
}

async function setup() {
  setTestNow(FIXED_NOW);
  const user = await createUser();
  const theme = await createTheme({ name: "Aurora Blog" });
  return { userId: user._id.toString(), themeId: theme._id.toString(), user, theme };
}

async function onlyOwnership() {
  const rows = await OwnershipModel.find().lean();
  expect(rows).toHaveLength(1);
  return rows[0];
}

describe("hasActiveOwnership", () => {
  it("is true only for an active ownership", async () => {
    const { userId, themeId } = await setup();
    const revokedTheme = await createTheme();
    const otherTheme = await createTheme();
    const otherUser = await createUser();
    await createOwnership(userId, themeId);
    await createOwnership(userId, revokedTheme._id.toString(), {
      status: "revoked",
      revokedAt: EARLIER,
      revokedReason: "admin",
      revokedByUserId: new Types.ObjectId(),
      revokeNote: "Chargeback",
    });

    expect(await hasActiveOwnership(userId, themeId)).toBe(true);
    expect(await hasActiveOwnership(userId, revokedTheme._id.toString())).toBe(false);
    expect(await hasActiveOwnership(userId, otherTheme._id.toString())).toBe(false);
    expect(await hasActiveOwnership(otherUser._id.toString(), themeId)).toBe(false);
    expect(await hasActiveOwnership("nope", themeId)).toBe(false);
    expect(await hasActiveOwnership(userId, "nope")).toBe(false);
  });
});

describe("grantFromOrder", () => {
  it("creates an active purchase ownership", async () => {
    const { userId, themeId } = await setup();
    const orderId = newOrderId();

    const result = await grantFromOrder({ userId, themeId, orderId });

    expect(result).toBe("created");
    const row = await onlyOwnership();
    expect(row?.status).toBe("active");
    expect(row?.source).toBe("purchase");
    expect(row?.orderId?.toString()).toBe(orderId);
    expect(row?.grantedByUserId).toBeNull();
    expect(row?.grantNote).toBeNull();
    expect(row?.licenseType).toBe("standard");
    expect(row?.revokedAt).toBeNull();
  });

  it("re-activates a revoked ownership in the same document", async () => {
    const { userId, themeId } = await setup();
    const revoked = await createOwnership(userId, themeId, {
      status: "revoked",
      source: "purchase",
      orderId: new Types.ObjectId(),
      grantedByUserId: null,
      revokedAt: EARLIER,
      revokedReason: "refund",
    });
    const orderId = newOrderId();

    const result = await grantFromOrder({ userId, themeId, orderId });

    expect(result).toBe("reactivated");
    const row = await onlyOwnership();
    expect(row?._id.toString()).toBe(revoked._id.toString());
    expect(row?.status).toBe("active");
    expect(row?.orderId?.toString()).toBe(orderId);
    expect(row?.source).toBe("purchase");
    expect(row?.revokedAt).toBeNull();
    expect(row?.revokedReason).toBeNull();
    expect(row?.revokedByUserId).toBeNull();
    expect(row?.revokeNote).toBeNull();
  });

  it("clears the admin data when it re-activates", async () => {
    const { userId, themeId } = await setup();
    await createOwnership(userId, themeId, {
      status: "revoked",
      source: "admin_grant",
      grantNote: "Beta tester",
      revokedAt: EARLIER,
      revokedReason: "admin",
      revokedByUserId: new Types.ObjectId(),
      revokeNote: "Chargeback",
    });

    await grantFromOrder({ userId, themeId, orderId: newOrderId() });

    const row = await onlyOwnership();
    expect(row?.grantedByUserId).toBeNull();
    expect(row?.grantNote).toBeNull();
  });

  it("leaves an active ownership unchanged", async () => {
    const { userId, themeId } = await setup();
    await createOwnership(userId, themeId, { grantNote: "Beta tester" });
    const before = await onlyOwnership();

    const result = await grantFromOrder({ userId, themeId, orderId: newOrderId() });

    expect(result).toBe("unchanged");
    const row = await onlyOwnership();
    expect(row?.source).toBe("admin_grant");
    expect(row?.orderId).toBeNull();
    expect(row).toEqual(before);
    expect(row?.grantNote).toBe("Beta tester");
  });

  it("joins the caller's transaction", async () => {
    const { userId, themeId } = await setup();

    await expect(
      withTransaction(async (session) => {
        await grantFromOrder({ userId, themeId, orderId: newOrderId() }, session);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await OwnershipModel.countDocuments()).toBe(0);
  });
});

describe("revokeForRefund", () => {
  it("revokes the ownership of this order", async () => {
    const { userId, themeId } = await setup();
    const orderId = newOrderId();
    await grantFromOrder({ userId, themeId, orderId });

    const result = await revokeForRefund({ userId, themeId, orderId });

    expect(result).toBe(true);
    const row = await onlyOwnership();
    expect(row?.status).toBe("revoked");
    expect(row?.revokedReason).toBe("refund");
    expect(row?.revokedAt).toEqual(FIXED_NOW);
    expect(row?.revokedByUserId).toBeNull();
    expect(row?.revokeNote).toBeNull();
  });

  it("does not revoke the ownership of a different order", async () => {
    const { userId, themeId } = await setup();
    await grantFromOrder({ userId, themeId, orderId: newOrderId() });

    const result = await revokeForRefund({ userId, themeId, orderId: newOrderId() });

    expect(result).toBe(false);
    expect((await onlyOwnership())?.status).toBe("active");
  });

  it("does not revoke an admin grant", async () => {
    const { userId, themeId } = await setup();
    await createOwnership(userId, themeId, { orderId: null });

    const result = await revokeForRefund({ userId, themeId, orderId: newOrderId() });

    expect(result).toBe(false);
    expect((await onlyOwnership())?.status).toBe("active");
  });

  it("ignores an ownership that is already revoked", async () => {
    const { userId, themeId } = await setup();
    const orderId = newOrderId();
    await createOwnership(userId, themeId, {
      status: "revoked",
      source: "purchase",
      orderId: new Types.ObjectId(orderId),
      grantedByUserId: null,
      revokedAt: EARLIER,
      revokedReason: "refund",
    });

    const result = await revokeForRefund({ userId, themeId, orderId });

    expect(result).toBe(false);
    expect((await onlyOwnership())?.revokedAt).toEqual(EARLIER);
  });
});

describe("listOwnedThemes", () => {
  it("returns only active ownerships of the user, sorted by theme name", async () => {
    const { userId } = await setup();
    const otherUser = await createUser();
    const zeta = await createTheme({ name: "Zeta" });
    const alpha = await createTheme({ name: "Alpha" });
    const beta = await createTheme({ name: "Beta" });
    const gamma = await createTheme({ name: "Gamma" });
    await createOwnership(userId, zeta._id.toString());
    await createOwnership(userId, alpha._id.toString());
    await createOwnership(userId, beta._id.toString(), {
      status: "revoked",
      revokedAt: EARLIER,
      revokedReason: "admin",
      revokedByUserId: new Types.ObjectId(),
      revokeNote: "Chargeback",
    });
    await createOwnership(otherUser._id.toString(), gamma._id.toString());

    const owned = await listOwnedThemes(userId);

    expect(owned.map((item) => item.theme.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("includes unpublished themes with their status and cover", async () => {
    const { userId } = await setup();
    const theme = await createTheme({
      name: "Retired",
      slug: "retired",
      status: "unpublished",
      images: [{ key: "theme-images/abc/1.png", alt: "Cover alt", width: 800, height: 600 }],
    });
    await createOwnership(userId, theme._id.toString());

    const owned = await listOwnedThemes(userId);

    expect(owned).toHaveLength(1);
    expect(owned[0]?.theme.id).toBe(theme._id.toString());
    expect(owned[0]?.theme.slug).toBe("retired");
    expect(owned[0]?.theme.status).toBe("unpublished");
    expect(owned[0]?.theme.coverImage).toEqual({
      url: "http://localhost:9000/store-images/theme-images/abc/1.png",
      alt: "Cover alt",
      width: 800,
      height: 600,
    });
  });

  it("lists versions newest first and leaves a theme without versions with an empty list", async () => {
    const { userId } = await setup();
    const withVersions = await createTheme({ name: "A with versions" });
    const withoutVersions = await createTheme({ name: "B without versions" });
    await createOwnership(userId, withVersions._id.toString());
    await createOwnership(userId, withoutVersions._id.toString());
    await createVersion(withVersions._id.toString(), { version: "1.0.0", releasedAt: EARLIER });
    await createVersion(withVersions._id.toString(), { version: "1.1.0", releasedAt: FIXED_NOW });

    const owned = await listOwnedThemes(userId);

    expect(owned.map((item) => item.theme.name)).toEqual(["A with versions", "B without versions"]);
    expect(owned[0]?.versions.map((version) => version.version)).toEqual(["1.1.0", "1.0.0"]);
    expect(owned[1]?.versions).toEqual([]);
  });

  it("returns an empty list for a user without ownerships", async () => {
    const { userId } = await setup();

    expect(await listOwnedThemes(userId)).toEqual([]);
  });
});

async function setupAdminCase() {
  const { userId, themeId, user, theme } = await setup();
  const admin = await createAdmin();
  return { userId, themeId, user, theme, adminId: admin._id.toString() };
}

describe("grantByAdmin", () => {
  it("creates an admin grant and logs it", async () => {
    const { userId, themeId, adminId, user, theme } = await setupAdminCase();

    await grantByAdmin({ userId, themeId, note: "Beta tester" }, adminId);

    const row = await onlyOwnership();
    expect(row?.status).toBe("active");
    expect(row?.source).toBe("admin_grant");
    expect(row?.grantedByUserId?.toString()).toBe(adminId);
    expect(row?.grantNote).toBe("Beta tester");
    expect(row?.orderId).toBeNull();
    const logs = await ActivityLogModel.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("ownership_granted");
    expect(logs[0]?.actorRole).toBe("admin");
    expect(logs[0]?.actorUserId?.toString()).toBe(adminId);
    expect(logs[0]?.subjectUserId?.toString()).toBe(userId);
    expect(logs[0]?.targetType).toBe("theme");
    expect(logs[0]?.targetId?.toString()).toBe(themeId);
    expect(logs[0]?.summary).toBe(`Theme granted: ${theme.name} to ${user.name}`);
  });

  it("saves a null note as null", async () => {
    const { userId, themeId, adminId } = await setupAdminCase();

    await grantByAdmin({ userId, themeId, note: null }, adminId);

    expect((await onlyOwnership())?.grantNote).toBeNull();
  });

  it("re-activates a revoked ownership in the same document", async () => {
    const { userId, themeId, adminId } = await setupAdminCase();
    const revoked = await createOwnership(userId, themeId, {
      status: "revoked",
      source: "purchase",
      orderId: new Types.ObjectId(),
      grantedByUserId: null,
      revokedAt: EARLIER,
      revokedReason: "refund",
    });

    await grantByAdmin({ userId, themeId, note: "Second chance" }, adminId);

    const row = await onlyOwnership();
    expect(row?._id.toString()).toBe(revoked._id.toString());
    expect(row?.status).toBe("active");
    expect(row?.source).toBe("admin_grant");
    expect(row?.grantedByUserId?.toString()).toBe(adminId);
    expect(row?.orderId).toBeNull();
    expect(row?.revokedAt).toBeNull();
    expect(row?.revokedReason).toBeNull();
    expect(row?.revokedByUserId).toBeNull();
    expect(row?.revokeNote).toBeNull();
  });

  it("refuses an active ownership", async () => {
    const { userId, themeId, adminId } = await setupAdminCase();
    await createOwnership(userId, themeId);
    const before = await onlyOwnership();

    await expect(grantByAdmin({ userId, themeId, note: null }, adminId)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This customer already owns this theme.",
    });

    expect(await onlyOwnership()).toEqual(before);
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("refuses an unknown theme and an unknown customer", async () => {
    const { userId, themeId, adminId } = await setupAdminCase();

    await expect(grantByAdmin({ userId, themeId: UNKNOWN_ID, note: null }, adminId)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Theme not found.",
    });
    await expect(grantByAdmin({ userId: UNKNOWN_ID, themeId, note: null }, adminId)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Customer not found.",
    });

    expect(await OwnershipModel.countDocuments()).toBe(0);
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });
});

describe("revokeByAdmin", () => {
  it("revokes with reason, admin and note and logs it", async () => {
    const { userId, themeId, adminId, user, theme } = await setupAdminCase();
    await createOwnership(userId, themeId);

    await revokeByAdmin({ userId, themeId, note: "Chargeback" }, adminId);

    const row = await onlyOwnership();
    expect(row?.status).toBe("revoked");
    expect(row?.revokedReason).toBe("admin");
    expect(row?.revokedByUserId?.toString()).toBe(adminId);
    expect(row?.revokeNote).toBe("Chargeback");
    expect(row?.revokedAt).toEqual(FIXED_NOW);
    const logs = await ActivityLogModel.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("ownership_revoked");
    expect(logs[0]?.actorRole).toBe("admin");
    expect(logs[0]?.actorUserId?.toString()).toBe(adminId);
    expect(logs[0]?.subjectUserId?.toString()).toBe(userId);
    expect(logs[0]?.targetType).toBe("theme");
    expect(logs[0]?.targetId?.toString()).toBe(themeId);
    expect(logs[0]?.summary).toBe(`Theme revoked: ${theme.name} from ${user.name}`);
  });

  it("can revoke a purchase ownership too (D-122)", async () => {
    const { userId, themeId, adminId } = await setupAdminCase();
    const orderId = newOrderId();
    await grantFromOrder({ userId, themeId, orderId });

    await revokeByAdmin({ userId, themeId, note: "Abuse" }, adminId);

    const row = await onlyOwnership();
    expect(row?.status).toBe("revoked");
    expect(row?.orderId?.toString()).toBe(orderId);
    expect(row?.revokedReason).toBe("admin");
  });

  it("refuses an already revoked ownership", async () => {
    const { userId, themeId, adminId } = await setupAdminCase();
    await createOwnership(userId, themeId, {
      status: "revoked",
      revokedAt: EARLIER,
      revokedReason: "admin",
      revokedByUserId: new Types.ObjectId(),
      revokeNote: "Old note",
    });
    const before = await onlyOwnership();

    await expect(revokeByAdmin({ userId, themeId, note: "Again" }, adminId)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This customer does not own this theme.",
    });

    expect(await onlyOwnership()).toEqual(before);
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("refuses a customer who never owned the theme", async () => {
    const { userId, themeId, adminId } = await setupAdminCase();

    await expect(revokeByAdmin({ userId, themeId, note: "Why" }, adminId)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This customer does not own this theme.",
    });

    expect(await OwnershipModel.countDocuments()).toBe(0);
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("refuses an unknown theme and an unknown customer", async () => {
    const { userId, themeId, adminId } = await setupAdminCase();

    await expect(revokeByAdmin({ userId, themeId: UNKNOWN_ID, note: "Why" }, adminId)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Theme not found.",
    });
    await expect(revokeByAdmin({ userId: UNKNOWN_ID, themeId, note: "Why" }, adminId)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Customer not found.",
    });
  });
});
