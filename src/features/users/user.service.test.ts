import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { UserModel } from "@/features/users/user.model";
import {
  getUserIdByEmail,
  getUserNames,
  getUserSummaries,
  getUserSummary,
  getUsersForNotification,
  isAdminEmail,
  listCustomerRowsAfter,
  setUserCountry,
} from "@/features/users/user.service";
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

describe("getUserSummary", () => {
  it("returns id, name, email and country", async () => {
    const user = await createUser({ name: "Ann Lee", email: "ann@example.com", country: "EG" });

    expect(await getUserSummary(user._id.toString())).toEqual({
      id: user._id.toString(),
      name: "Ann Lee",
      email: "ann@example.com",
      country: "EG",
    });
  });

  it("returns a null country for a user without one", async () => {
    const user = await createUser({ country: null });

    expect((await getUserSummary(user._id.toString()))?.country).toBeNull();
  });

  it("returns null for an invalid id and for an unknown id", async () => {
    expect(await getUserSummary("not-an-id")).toBeNull();
    expect(await getUserSummary(new Types.ObjectId().toString())).toBeNull();
  });
});

describe("getUserSummaries", () => {
  it("returns id, name, email and country for known ids and skips unknown and invalid ids", async () => {
    const ann = await createUser({ name: "Ann Lee", email: "ann@example.com", country: "EG" });
    const bob = await createUser({ name: "Bob Ray", email: "bob@example.com", country: null });

    const summaries = await getUserSummaries([
      ann._id.toString(),
      bob._id.toString(),
      new Types.ObjectId().toString(),
      "x",
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries).toContainEqual({
      id: ann._id.toString(),
      name: "Ann Lee",
      email: "ann@example.com",
      country: "EG",
    });
    expect(summaries).toContainEqual({
      id: bob._id.toString(),
      name: "Bob Ray",
      email: "bob@example.com",
      country: null,
    });
  });
});

describe("getUsersForNotification", () => {
  it("returns the four switches and disabled; skips unknown and invalid ids", async () => {
    const ann = await createUser({ name: "Ann Lee", email: "ann@example.com" });
    const bob = await createUser({
      name: "Bob Ray",
      email: "bob@example.com",
      disabled: true,
      emailOwnedThemeUpdates: false,
      emailFavoriteThemeUpdates: false,
      emailFollowedCategoryThemes: false,
      emailAnnouncements: false,
    });

    const users = await getUsersForNotification([
      ann._id.toString(),
      bob._id.toString(),
      new Types.ObjectId().toString(),
      "x",
    ]);

    expect(users).toHaveLength(2);
    expect(users).toContainEqual({
      id: ann._id.toString(),
      name: "Ann Lee",
      email: "ann@example.com",
      disabled: false,
      emailOwnedThemeUpdates: true,
      emailFavoriteThemeUpdates: true,
      emailFollowedCategoryThemes: true,
      emailAnnouncements: true,
    });
    expect(users).toContainEqual({
      id: bob._id.toString(),
      name: "Bob Ray",
      email: "bob@example.com",
      disabled: true,
      emailOwnedThemeUpdates: false,
      emailFavoriteThemeUpdates: false,
      emailFollowedCategoryThemes: false,
      emailAnnouncements: false,
    });
    expect(await getUsersForNotification([])).toEqual([]);
  });
});

describe("listCustomerRowsAfter", () => {
  it("skips disabled users, _id ascending, after the cursor", async () => {
    const first = await createUser();
    await createUser({ disabled: true });
    const second = await createUser();
    const third = await createUser();

    const all = await listCustomerRowsAfter({ afterId: null, limit: 10 });
    const afterFirst = await listCustomerRowsAfter({ afterId: first._id.toString(), limit: 10 });
    const limited = await listCustomerRowsAfter({ afterId: null, limit: 2 });

    expect(all).toEqual([
      { rowId: first._id.toString(), userId: first._id.toString() },
      { rowId: second._id.toString(), userId: second._id.toString() },
      { rowId: third._id.toString(), userId: third._id.toString() },
    ]);
    expect(afterFirst.map((row) => row.userId)).toEqual([second._id.toString(), third._id.toString()]);
    expect(limited.map((row) => row.userId)).toEqual([first._id.toString(), second._id.toString()]);
  });
});
