import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { auth } from "@/features/auth/auth";
import { AuthAttemptModel } from "@/features/auth/auth-attempt.model";
import {
  changeUserPassword,
  loginUser,
  registerUser,
  requestPasswordReset,
  resendVerificationEmail,
  resetPassword,
  updateUserName,
} from "@/features/auth/auth.service";
import { UserModel } from "@/features/users/user.model";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";
import { createSessionHeaders } from "@/shared/test/session-headers";

const REGISTER_INPUT = { name: "Ann Lee", email: "ann@example.com", password: "password123", country: "EG" };

function sessionCollection() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database is not connected.");
  return db.collection("session");
}

describe("registerUser", () => {
  it("creates the user with country and default settings", async () => {
    await registerUser(REGISTER_INPUT, new Headers());

    const users = await UserModel.find({ email: "ann@example.com" }).lean();
    expect(users).toHaveLength(1);
    expect(users[0]?.name).toBe("Ann Lee");
    expect(users[0]?.country).toBe("EG");
    expect(users[0]?.disabled).toBe(false);
    expect(users[0]?.emailOwnedThemeUpdates).toBe(true);
    expect(users[0]?.emailFavoriteThemeUpdates).toBe(true);
    expect(users[0]?.emailFollowedCategoryThemes).toBe(true);
    expect(users[0]?.emailAnnouncements).toBe(true);
    expect(users[0]?.emailVerified).toBe(false);
  });

  it("sends one verification email", async () => {
    await registerUser(REGISTER_INPUT, new Headers());

    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(fakeEmailSender.sent[0]?.to).toBe("ann@example.com");
    expect(fakeEmailSender.sent[0]?.templateName).toBe("VerifyEmail");
    expect(fakeEmailSender.sent[0]?.text).toContain("http://localhost:3000/");
  });

  it("refuses an email that is already used", async () => {
    await registerUser(REGISTER_INPUT, new Headers());

    await expect(registerUser(REGISTER_INPUT, new Headers())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "An account with this email already exists. Log in instead.",
    });
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it("logs one user_registered row", async () => {
    await registerUser(REGISTER_INPUT, new Headers());

    const user = await UserModel.findOne({ email: "ann@example.com" }).lean();
    const rows = await ActivityLogModel.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("user_registered");
    expect(rows[0]?.actorRole).toBe("customer");
    expect(rows[0]?.actorUserId?.toString()).toBe(user?._id.toString());
    expect(rows[0]?.subjectUserId?.toString()).toBe(user?._id.toString());
    expect(rows[0]?.targetType).toBe("user");
    expect(rows[0]?.targetId?.toString()).toBe(user?._id.toString());
    expect(rows[0]?.summary).toBe("Customer registered: Ann Lee");
  });
});

describe("loginUser", () => {
  it("creates a session for the right password", async () => {
    await registerUser(REGISTER_INPUT, new Headers());
    const user = await UserModel.findOne({ email: "ann@example.com" }).lean();
    await sessionCollection().deleteMany({});

    await loginUser({ email: "ann@example.com", password: "password123" }, new Headers());

    const sessions = await sessionCollection().find({ userId: user?._id }).toArray();
    expect(sessions).toHaveLength(1);
  });

  it("refuses a wrong password", async () => {
    await registerUser(REGISTER_INPUT, new Headers());
    await sessionCollection().deleteMany({});

    await expect(
      loginUser({ email: "ann@example.com", password: "wrong-password" }, new Headers()),
    ).rejects.toMatchObject({
      code: "INVALID",
      message: "Wrong email or password.",
    });
    expect(await sessionCollection().countDocuments()).toBe(0);
  });

  it("refuses a disabled user", async () => {
    await registerUser(REGISTER_INPUT, new Headers());
    await UserModel.updateOne({ email: "ann@example.com" }, { $set: { disabled: true } });
    await sessionCollection().deleteMany({});

    await expect(loginUser({ email: "ann@example.com", password: "password123" }, new Headers())).rejects.toMatchObject(
      {
        code: "FORBIDDEN",
        message: "This account has been disabled. Contact support if you think this is a mistake.",
      },
    );
    expect(await sessionCollection().countDocuments()).toBe(0);
  });
});

describe("requestPasswordReset", () => {
  it("sends a reset email for a known address and nothing for an unknown one", async () => {
    await registerUser(REGISTER_INPUT, new Headers());
    fakeEmailSender.reset();

    await requestPasswordReset("ann@example.com", new Headers());
    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(fakeEmailSender.sent[0]?.to).toBe("ann@example.com");
    expect(fakeEmailSender.sent[0]?.templateName).toBe("ResetPasswordEmail");

    await expect(requestPasswordReset("nobody@example.com", new Headers())).resolves.toBeUndefined();
    expect(fakeEmailSender.sent).toHaveLength(1);
  });
});

describe("resetPassword", () => {
  it("refuses an invalid token", async () => {
    await expect(resetPassword("not-a-real-token", "new-password-123", new Headers())).rejects.toMatchObject({
      code: "INVALID",
      message: "This reset link is invalid or has expired. Please ask for a new one.",
    });
  });
});

describe("updateUserName", () => {
  it("changes the name through Better Auth", async () => {
    await registerUser(REGISTER_INPUT, new Headers());
    const headers = await createSessionHeaders("ann@example.com", "password123");

    await updateUserName("New Name", headers);

    const user = await UserModel.findOne({ email: "ann@example.com" }).lean();
    expect(user?.name).toBe("New Name");
    expect(user?.email).toBe("ann@example.com");
  });
});

describe("changeUserPassword", () => {
  it("changes the password and revokes the other sessions", async () => {
    await registerUser(REGISTER_INPUT, new Headers());
    const user = await UserModel.findOne({ email: "ann@example.com" }).lean();
    const firstHeaders = await createSessionHeaders("ann@example.com", "password123");
    const secondHeaders = await createSessionHeaders("ann@example.com", "password123");
    await changeUserPassword({ currentPassword: "password123", newPassword: "new-password-456" }, firstHeaders);

    expect(await sessionCollection().countDocuments({ userId: user?._id })).toBe(1);
    expect(await auth.api.getSession({ headers: secondHeaders })).toBeNull();
    await loginUser({ email: "ann@example.com", password: "new-password-456" }, new Headers());
    expect(await sessionCollection().countDocuments({ userId: user?._id })).toBe(2);
    await expect(loginUser({ email: "ann@example.com", password: "password123" }, new Headers())).rejects.toMatchObject(
      { code: "INVALID", message: "Wrong email or password." },
    );
  });

  it("refuses a wrong current password", async () => {
    await registerUser(REGISTER_INPUT, new Headers());
    const headers = await createSessionHeaders("ann@example.com", "password123");

    await expect(
      changeUserPassword({ currentPassword: "not-my-password", newPassword: "new-password-456" }, headers),
    ).rejects.toMatchObject({ code: "INVALID", message: "Your current password is wrong." });

    await loginUser({ email: "ann@example.com", password: "password123" }, new Headers());
  });
});

describe("loginUser", () => {
  it("records a failed login and refuses the 6th try with the right password", async () => {
    await registerUser(REGISTER_INPUT, new Headers());
    await sessionCollection().deleteMany({});
    const headers = new Headers({ "cf-connecting-ip": "9.9.9.9" });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(loginUser({ email: "ann@example.com", password: "wrong-password" }, headers)).rejects.toMatchObject({
        code: "INVALID",
        message: "Wrong email or password.",
      });
    }

    await expect(loginUser({ email: "ann@example.com", password: "password123" }, headers)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "Too many attempts. Please wait a minute and try again.",
    });
    const rows = await AuthAttemptModel.find({ kind: "login_failed" }).lean();
    expect(rows).toHaveLength(5);
    expect(rows[0]?.email).toBe("ann@example.com");
    expect(rows[0]?.ip).toBe("9.9.9.9");
    expect(await sessionCollection().countDocuments()).toBe(0);
  });

  it("a successful login records nothing", async () => {
    await registerUser(REGISTER_INPUT, new Headers());

    await loginUser({ email: "ann@example.com", password: "password123" }, new Headers());

    expect(await AuthAttemptModel.countDocuments()).toBe(0);
  });
});

describe("requestPasswordReset", () => {
  it("sends at most 3 reset emails per hour for one address and stays silent after that", async () => {
    await registerUser(REGISTER_INPUT, new Headers());
    fakeEmailSender.reset();

    for (let call = 0; call < 4; call += 1) {
      await expect(requestPasswordReset("ann@example.com", new Headers())).resolves.toBeUndefined();
    }

    const resetEmails = fakeEmailSender.sent.filter((email) => email.templateName === "ResetPasswordEmail");
    expect(resetEmails).toHaveLength(3);
    expect(fakeEmailSender.sent).toHaveLength(3);
    expect(await AuthAttemptModel.countDocuments({ kind: "auth_email" })).toBe(3);
  });
});

describe("resendVerificationEmail", () => {
  it("refuses the 4th within an hour with RATE_LIMITED", async () => {
    await registerUser(REGISTER_INPUT, new Headers());
    fakeEmailSender.reset();

    for (let call = 0; call < 3; call += 1) {
      await resendVerificationEmail("ann@example.com", new Headers());
    }

    await expect(resendVerificationEmail("ann@example.com", new Headers())).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "Too many attempts. Please wait a minute and try again.",
    });
    expect(fakeEmailSender.sent).toHaveLength(3);
    expect(await AuthAttemptModel.countDocuments({ kind: "auth_email" })).toBe(3);
  });
});
