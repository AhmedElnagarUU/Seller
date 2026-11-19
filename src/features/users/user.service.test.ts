import mongoose, { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { loginUser, registerUser } from "@/features/auth/auth.service";
import { UserModel } from "@/features/users/user.model";
import {
  disableUser,
  enableUser,
  findCustomerByEmail,
  getUserIdByEmail,
  getUserNames,
  getUserSummaries,
  getUserSummary,
  getUsersForNotification,
  isAdminEmail,
  listCustomerRowsAfter,
  listCustomers,
  setUserCountry,
} from "@/features/users/user.service";
import { setTestNow } from "@/shared/lib/clock";
import { createAdmin, createOwnership, createTheme, createUser } from "@/shared/test/factories";

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

const REGISTER_PASSWORD = "password123";

describe("listCustomers", () => {
  it("finds by name or email, ignoring case, and treats regex characters as text", async () => {
    const ann = await createUser({ name: "Ann Lee", email: "ann@example.com" });
    const bob = await createUser({ name: "Bob Ray", email: "bob@example.com" });
    const literal = await createUser({ name: "Plain", email: "a+b@example.com" });
    await createUser({ name: "Aab", email: "aab@example.com" });

    const byName = await listCustomers({ q: "ANN LEE", status: undefined, page: 1 });
    const byEmail = await listCustomers({ q: "BOB@example", status: undefined, page: 1 });
    const byRegexText = await listCustomers({ q: "a+b", status: undefined, page: 1 });

    expect(byName.items.map((item) => item.id)).toEqual([ann._id.toString()]);
    expect(byEmail.items.map((item) => item.id)).toEqual([bob._id.toString()]);
    expect(byRegexText.items.map((item) => item.id)).toEqual([literal._id.toString()]);
    expect(byRegexText.total).toBe(1);
  });

  it("filters active and disabled", async () => {
    const disabled = await createUser({ disabled: true });
    const first = await createUser();
    const second = await createUser();

    const onlyDisabled = await listCustomers({ q: "", status: "disabled", page: 1 });
    const onlyActive = await listCustomers({ q: "", status: "active", page: 1 });

    expect(onlyDisabled.items.map((item) => item.id)).toEqual([disabled._id.toString()]);
    expect(onlyDisabled.items[0]?.isDisabled).toBe(true);
    expect(onlyActive.items.map((item) => item.id).sort()).toEqual(
      [first._id.toString(), second._id.toString()].sort(),
    );
    expect(onlyActive.items.every((item) => !item.isDisabled)).toBe(true);
  });

  it("lists the newest joined first, 20 per page", async () => {
    const created: string[] = [];
    for (let index = 0; index < 25; index += 1) {
      const user = await createUser({ createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)) });
      created.push(user._id.toString());
    }

    const pageOne = await listCustomers({ q: "", status: undefined, page: 1 });
    const pageTwo = await listCustomers({ q: "", status: undefined, page: 2 });

    expect(pageOne.items).toHaveLength(20);
    expect(pageTwo.items).toHaveLength(5);
    expect(pageOne.totalPages).toBe(2);
    expect(pageOne.total).toBe(25);
    expect(pageOne.page).toBe(1);
    expect(pageTwo.page).toBe(2);
    expect(pageOne.items.map((item) => item.id)).toEqual(created.slice(5).reverse());
    expect(pageTwo.items.map((item) => item.id)).toEqual(created.slice(0, 5).reverse());
  });

  it("counts only active ownerships", async () => {
    const user = await createUser();
    const owned = await createTheme();
    const lost = await createTheme();
    await createOwnership(user._id.toString(), owned._id.toString());
    await createOwnership(user._id.toString(), lost._id.toString(), {
      status: "revoked",
      revokedAt: new Date("2026-10-01T10:00:00Z"),
      revokedReason: "admin",
      revokedByUserId: new Types.ObjectId(),
      revokeNote: "Chargeback",
    });
    await createUser();

    const result = await listCustomers({ q: "", status: undefined, page: 1 });

    const row = result.items.find((item) => item.id === user._id.toString());
    expect(row?.ownedCount).toBe(1);
    expect(result.items.filter((item) => item.ownedCount === 0)).toHaveLength(1);
  });
});

describe("findCustomerByEmail", () => {
  it("finds a customer ignoring case and spaces and returns null for an unknown email", async () => {
    const user = await createUser({ email: "ann@example.com" });

    expect(await findCustomerByEmail("  ANN@Example.com ")).toEqual({ id: user._id.toString() });
    expect(await findCustomerByEmail("nobody@example.com")).toBeNull();
  });
});

function sessionCollection() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database is not connected.");
  return db.collection("session");
}

// A registered customer with one login session.
async function registerWithSession(email: string) {
  await registerUser({ name: "Ann Lee", email, password: REGISTER_PASSWORD, country: "EG" }, new Headers());
  await loginUser({ email, password: REGISTER_PASSWORD }, new Headers());
  const user = await UserModel.findOne({ email }).lean();
  if (!user) throw new Error("The user was not created.");
  return user;
}

describe("disableUser", () => {
  it("saves the flags, deletes that user's sessions only and logs it", async () => {
    const now = new Date("2026-11-01T10:00:00Z");
    const user = await registerWithSession("ann@example.com");
    const other = await registerWithSession("bob@example.com");
    const admin = await createAdmin();
    expect(await sessionCollection().countDocuments({ userId: user._id })).toBeGreaterThan(0);
    setTestNow(now);

    await disableUser(user._id.toString(), "Spam", admin._id.toString());

    const saved = await UserModel.findById(user._id).lean();
    expect(saved?.disabled).toBe(true);
    expect(saved?.disabledReason).toBe("Spam");
    expect(saved?.disabledAt).toEqual(now);
    expect(await sessionCollection().countDocuments({ userId: user._id })).toBe(0);
    expect(await sessionCollection().countDocuments({ userId: other._id })).toBeGreaterThan(0);
    const logs = await ActivityLogModel.find({ action: "account_disabled" }).lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.actorRole).toBe("admin");
    expect(logs[0]?.actorUserId?.toString()).toBe(admin._id.toString());
    expect(logs[0]?.subjectUserId?.toString()).toBe(user._id.toString());
    expect(logs[0]?.targetType).toBe("user");
    expect(logs[0]?.targetId?.toString()).toBe(user._id.toString());
    expect(logs[0]?.summary).toBe("Account disabled: ann@example.com");
  });

  it("refuses the admin's own account", async () => {
    const admin = await createAdmin();

    await expect(disableUser(admin._id.toString(), "Oops", admin._id.toString())).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You cannot disable your own account.",
    });

    const saved = await UserModel.findById(admin._id).lean();
    expect(saved?.disabled).toBe(false);
    expect(saved?.disabledReason).toBeNull();
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("refuses an already disabled account and an unknown id", async () => {
    const admin = await createAdmin();
    const disabledAt = new Date("2026-10-01T10:00:00Z");
    const user = await createUser({ disabled: true, disabledReason: "First", disabledAt });

    await expect(disableUser(user._id.toString(), "Second", admin._id.toString())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This account is already disabled.",
    });
    await expect(disableUser(new Types.ObjectId().toString(), "Why", admin._id.toString())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Customer not found.",
    });
    await expect(disableUser("not-an-id", "Why", admin._id.toString())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Customer not found.",
    });

    const saved = await UserModel.findById(user._id).lean();
    expect(saved?.disabledReason).toBe("First");
    expect(saved?.disabledAt).toEqual(disabledAt);
    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });

  it("a disabled customer cannot log in", async () => {
    const user = await registerWithSession("ann@example.com");
    const admin = await createAdmin();

    await disableUser(user._id.toString(), "Spam", admin._id.toString());

    await expect(
      loginUser({ email: "ann@example.com", password: REGISTER_PASSWORD }, new Headers()),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "This account has been disabled. Contact support if you think this is a mistake.",
    });
    expect(await sessionCollection().countDocuments({ userId: user._id })).toBe(0);
  });
});

describe("enableUser", () => {
  it("clears the flags, logs it and lets the customer log in again", async () => {
    const user = await registerWithSession("ann@example.com");
    const admin = await createAdmin();
    await disableUser(user._id.toString(), "Spam", admin._id.toString());

    await enableUser(user._id.toString(), admin._id.toString());

    const saved = await UserModel.findById(user._id).lean();
    expect(saved?.disabled).toBe(false);
    expect(saved?.disabledReason).toBeNull();
    expect(saved?.disabledAt).toBeNull();
    const logs = await ActivityLogModel.find({ action: "account_enabled" }).lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.actorRole).toBe("admin");
    expect(logs[0]?.actorUserId?.toString()).toBe(admin._id.toString());
    expect(logs[0]?.subjectUserId?.toString()).toBe(user._id.toString());
    expect(logs[0]?.targetType).toBe("user");
    expect(logs[0]?.summary).toBe("Account enabled: ann@example.com");
    await loginUser({ email: "ann@example.com", password: REGISTER_PASSWORD }, new Headers());
    expect(await sessionCollection().countDocuments({ userId: user._id })).toBe(1);
  });

  it("refuses an account that is not disabled", async () => {
    const user = await createUser();
    const admin = await createAdmin();

    await expect(enableUser(user._id.toString(), admin._id.toString())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This account is not disabled.",
    });
    await expect(enableUser(new Types.ObjectId().toString(), admin._id.toString())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Customer not found.",
    });

    expect(await ActivityLogModel.countDocuments()).toBe(0);
  });
});
