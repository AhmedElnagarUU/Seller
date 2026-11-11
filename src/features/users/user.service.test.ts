import { describe, expect, it } from "vitest";
import { UserModel } from "@/features/users/user.model";
import { getUserIdByEmail, getUserNames, isAdminEmail, setUserCountry } from "@/features/users/user.service";
import { createUser } from "@/shared/test/factories";

async function createTestUser(country: string | null) {
  const user = await UserModel.create({ name: "Ann Lee", email: "ann@example.com", country });
  return user._id.toString();
}

describe("setUserCountry", () => {
  it("saves a valid code", async () => {
    const userId = await createTestUser(null);

    await setUserCountry(userId, "US");

    const saved = await UserModel.findById(userId).lean();
    expect(saved?.country).toBe("US");
  });

  it("refuses an unknown code", async () => {
    const userId = await createTestUser("EG");

    await expect(setUserCountry(userId, "XX")).rejects.toMatchObject({
      code: "INVALID",
      message: "Please choose your country.",
    });

    const saved = await UserModel.findById(userId).lean();
    expect(saved?.country).toBe("EG");
  });
});

describe("isAdminEmail", () => {
  it("matches case-insensitively", () => {
    expect(isAdminEmail("Admin@Example.com")).toBe(true);
    expect(isAdminEmail("other@example.com")).toBe(false);
  });
});

describe("getUserIdByEmail", () => {
  it("finds a user by email ignoring case and spaces; returns null for an unknown email", async () => {
    const user = await createUser({ email: "ann@example.com" });

    expect(await getUserIdByEmail("  ANN@Example.com ")).toBe(user._id.toString());
    expect(await getUserIdByEmail("nobody@example.com")).toBeNull();
  });
});

describe("getUserNames", () => {
  it("returns a map of id → name and leaves out unknown and invalid ids", async () => {
    const ann = await createUser({ name: "Ann Lee" });
    const bob = await createUser({ name: "Bob Ray" });
    const unknownId = "665f1c2e8f1b2c3d4e5f6a7b";

    const names = await getUserNames([ann._id.toString(), bob._id.toString(), unknownId, "not-an-id"]);

    expect(names.size).toBe(2);
    expect(names.get(ann._id.toString())).toBe("Ann Lee");
    expect(names.get(bob._id.toString())).toBe("Bob Ray");
    expect(names.has(unknownId)).toBe(false);
    expect(names.has("not-an-id")).toBe(false);
  });
});
