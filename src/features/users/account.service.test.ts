import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { registerUser } from "@/features/auth/auth.service";
import { NotificationModel } from "@/features/notifications/notification.model";
import {
  getAccountOverview,
  getAccountSettings,
  updateEmailPreferences,
  updateProfile,
} from "@/features/users/account.service";
import { UserModel } from "@/features/users/user.model";
import { createOwnership, createTheme, createUser, createWalletPayment } from "@/shared/test/factories";
import { createSessionHeaders } from "@/shared/test/session-headers";

const REGISTER_INPUT = { name: "Ann Lee", email: "ann@example.com", password: "password123", country: "EG" };

async function registerAnn(): Promise<string> {
  await registerUser(REGISTER_INPUT, new Headers());
  const user = await UserModel.findOne({ email: "ann@example.com" }).lean();
  if (!user) throw new Error("User was not created.");
  return user._id.toString();
}

async function saveNotification(userId: string, fields: { readAt?: Date | null; title?: string; createdAt?: Date }) {
  await NotificationModel.create({
    userId: new Types.ObjectId(userId),
    type: "announcement",
    title: "Big sale",
    body: "Everything is cheaper this week.",
    link: "/themes",
    readAt: null,
    ...fields,
  });
}

describe("getAccountSettings", () => {
  it("returns profile, the four switches and hasPassword", async () => {
    const annId = await registerAnn();
    const noPassword = await createUser({ name: "No Password", email: "nopass@example.com", country: "US" });

    const withPassword = await getAccountSettings(annId);
    const withoutPassword = await getAccountSettings(noPassword._id.toString());

    expect(withPassword).toEqual({
      name: "Ann Lee",
      email: "ann@example.com",
      country: "EG",
      hasPassword: true,
      emailOwnedThemeUpdates: true,
      emailFavoriteThemeUpdates: true,
      emailFollowedCategoryThemes: true,
      emailAnnouncements: true,
    });
    expect(withoutPassword?.hasPassword).toBe(false);
    expect(withoutPassword?.country).toBe("US");
    expect(withoutPassword?.emailAnnouncements).toBe(true);
    expect(await getAccountSettings(new Types.ObjectId().toString())).toBeNull();
  });
});

describe("updateProfile", () => {
  it("saves the country and the name", async () => {
    const annId = await registerAnn();
    const headers = await createSessionHeaders("ann@example.com", "password123");

    await updateProfile(annId, { name: "Ann Renamed", country: "US" }, headers);

    const user = await UserModel.findById(annId).lean();
    expect(user?.country).toBe("US");
    expect(user?.name).toBe("Ann Renamed");
    expect(user?.email).toBe("ann@example.com");
  });

  it("refuses an unknown country and writes nothing", async () => {
    const annId = await registerAnn();
    const headers = await createSessionHeaders("ann@example.com", "password123");

    await expect(updateProfile(annId, { name: "Ann Renamed", country: "XX" }, headers)).rejects.toMatchObject({
      code: "INVALID",
      message: "Please choose your country.",
    });

    const user = await UserModel.findById(annId).lean();
    expect(user?.name).toBe("Ann Lee");
    expect(user?.country).toBe("EG");
  });
});

describe("updateEmailPreferences", () => {
  it("saves the four switches and nothing else", async () => {
    const user = await createUser({ name: "Bob", email: "bob@example.com", country: "US" });

    await updateEmailPreferences(user._id.toString(), {
      emailOwnedThemeUpdates: false,
      emailFavoriteThemeUpdates: false,
      emailFollowedCategoryThemes: false,
      emailAnnouncements: false,
    });

    const saved = await UserModel.findById(user._id).lean();
    expect(saved?.emailOwnedThemeUpdates).toBe(false);
    expect(saved?.emailFavoriteThemeUpdates).toBe(false);
    expect(saved?.emailFollowedCategoryThemes).toBe(false);
    expect(saved?.emailAnnouncements).toBe(false);
    expect(saved?.name).toBe("Bob");
    expect(saved?.email).toBe("bob@example.com");
    expect(saved?.country).toBe("US");
    expect(saved?.disabled).toBe(false);
  });
});

describe("getAccountOverview", () => {
  it("counts owned themes and unread notifications and returns the latest 5", async () => {
    const user = await createUser({ country: "US" });
    const userId = user._id.toString();
    const ownedTheme = await createTheme({ status: "published" });
    const revokedTheme = await createTheme({ status: "published" });
    await createOwnership(userId, ownedTheme._id.toString());
    await createOwnership(userId, revokedTheme._id.toString(), {
      status: "revoked",
      revokedAt: new Date("2026-02-01T00:00:00Z"),
      revokedReason: "refund",
      revokedByUserId: new Types.ObjectId(),
    });
    for (let index = 1; index <= 7; index += 1) {
      await saveNotification(userId, {
        title: `Notice ${index}`,
        readAt: index <= 3 ? null : new Date("2026-03-01T00:00:00Z"),
        createdAt: new Date(`2026-03-0${index}T10:00:00Z`),
      });
    }

    const overview = await getAccountOverview(userId);

    expect(overview.ownedCount).toBe(1);
    expect(overview.unreadCount).toBe(3);
    expect(overview.latestNotifications.map((item) => item.title)).toEqual([
      "Notice 7",
      "Notice 6",
      "Notice 5",
      "Notice 4",
      "Notice 3",
    ]);
  });

  it("returns the 4 best-selling published themes", async () => {
    const user = await createUser({ country: "US" });
    const published = [];
    for (let sales = 1; sales <= 5; sales += 1) {
      const theme = await createTheme({ status: "published", stats: { salesCount: sales, downloadCount: 0 } });
      published.push(theme);
    }
    await createTheme({ status: "draft", stats: { salesCount: 99, downloadCount: 0 } });

    const overview = await getAccountOverview(user._id.toString());

    expect(overview.bestSellers.map((card) => card.id)).toEqual([
      published[4]?._id.toString(),
      published[3]?._id.toString(),
      published[2]?._id.toString(),
      published[1]?._id.toString(),
    ]);
  });

  it("reports open wallet payments only for Egypt", async () => {
    const american = await createUser({ country: "US" });
    const egyptian = await createUser({ country: "EG" });
    for (const status of ["awaiting_payment", "submitted", "approved", "rejected", "cancelled"] as const) {
      await createWalletPayment({ userId: egyptian._id, status });
    }
    await createWalletPayment({ userId: american._id, status: "awaiting_payment" });

    expect((await getAccountOverview(american._id.toString())).openWalletPayments).toBeNull();
    expect((await getAccountOverview(egyptian._id.toString())).openWalletPayments).toBe(2);
  });
});
