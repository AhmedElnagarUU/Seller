import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { loginUser, registerUser, requestPasswordReset, resetPassword } from "@/features/auth/auth.service";
import { UserModel } from "@/features/users/user.model";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";

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
