import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { OwnershipModel } from "@/features/ownerships/ownership.model";

function buildFields(overrides: Record<string, unknown> = {}) {
  return {
    userId: new Types.ObjectId(),
    themeId: new Types.ObjectId(),
    status: "active",
    source: "admin_grant",
    grantedByUserId: new Types.ObjectId(),
    ...overrides,
  };
}

// Saves an ownership from loose test input (the tests also pass values that the types refuse).
async function saveOwnership(fields: Record<string, unknown>) {
  const ownership = new OwnershipModel();
  ownership.set(fields);
  return ownership.save();
}

// The names of the fields that a ValidationError complains about.
async function refusedKeysOf(fields: Record<string, unknown>): Promise<string[]> {
  const error: unknown = await saveOwnership(fields).then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toMatchObject({ name: "ValidationError" });
  const errors = typeof error === "object" && error !== null && "errors" in error ? error.errors : {};
  return Object.keys(errors ?? {});
}

describe("ownership model", () => {
  it("refuses a second ownership for the same user and theme", async () => {
    await OwnershipModel.init();
    const userId = new Types.ObjectId();
    const themeId = new Types.ObjectId();
    await saveOwnership(buildFields({ userId, themeId }));

    await expect(saveOwnership(buildFields({ userId, themeId }))).rejects.toMatchObject({ code: 11000 });
    expect(await OwnershipModel.countDocuments()).toBe(1);
  });

  it("refuses a purchase without an order", async () => {
    const keys = await refusedKeysOf(buildFields({ source: "purchase", grantedByUserId: null, orderId: null }));

    expect(keys).toEqual(["orderId"]);
    expect(await OwnershipModel.countDocuments()).toBe(0);
  });

  it("refuses an admin grant without the admin", async () => {
    const keys = await refusedKeysOf(buildFields({ grantedByUserId: null }));

    expect(keys).toEqual(["grantedByUserId"]);
    expect(await OwnershipModel.countDocuments()).toBe(0);
  });

  it("refuses an admin revoke without admin and note", async () => {
    const keys = await refusedKeysOf(
      buildFields({ status: "revoked", revokedAt: new Date(), revokedReason: "admin", revokedByUserId: null }),
    );

    expect(keys.sort()).toEqual(["revokeNote", "revokedByUserId"]);
    expect(await OwnershipModel.countDocuments()).toBe(0);
  });

  it("saves defaults", async () => {
    const saved = await saveOwnership(buildFields());

    expect(saved.licenseType).toBe("standard");
    expect(saved.grantNote).toBeNull();
    expect(saved.revokedAt).toBeNull();
    expect(saved.revokedReason).toBeNull();
  });

  it("keeps the three indexes", async () => {
    await OwnershipModel.init();

    const indexes = await OwnershipModel.collection.indexes();

    const unique = indexes.find((index) => JSON.stringify(index.key) === JSON.stringify({ userId: 1, themeId: 1 }));
    expect(unique?.unique).toBe(true);
    expect(indexes.map((index) => JSON.stringify(index.key))).toEqual(
      expect.arrayContaining([
        JSON.stringify({ themeId: 1, status: 1, _id: 1 }),
        JSON.stringify({ userId: 1, status: 1 }),
      ]),
    );
  });
});
