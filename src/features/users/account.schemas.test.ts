import { describe, expect, it } from "vitest";
import { changePasswordSchema, profileSchema } from "@/features/users/account.schemas";

describe("profileSchema", () => {
  it("refuses a 1-character name and country XX with invalidName / invalidCountry", () => {
    const result = profileSchema.safeParse({ name: "A", country: "XX" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.find((issue) => issue.path[0] === "name")?.message).toBe(
      "Enter your name (2 to 80 characters).",
    );
    expect(result.error?.issues.find((issue) => issue.path[0] === "country")?.message).toBe(
      "Please choose your country.",
    );
    expect(profileSchema.safeParse({ name: " Ann Lee ", country: "US" }).data).toEqual({
      name: "Ann Lee",
      country: "US",
    });
  });
});

describe("changePasswordSchema", () => {
  it("refuses a short new password and different passwords, and an empty current password", () => {
    const short = changePasswordSchema.safeParse({
      currentPassword: "old-password",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(short.error?.issues.find((issue) => issue.path[0] === "newPassword")?.message).toBe(
      "Use 8 to 128 characters.",
    );

    const different = changePasswordSchema.safeParse({
      currentPassword: "old-password",
      newPassword: "new-password-1",
      confirmPassword: "new-password-2",
    });
    expect(different.error?.issues.find((issue) => issue.path[0] === "confirmPassword")?.message).toBe(
      "The passwords do not match.",
    );

    const empty = changePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "new-password-1",
      confirmPassword: "new-password-1",
    });
    expect(empty.error?.issues.find((issue) => issue.path[0] === "currentPassword")?.message).toBe(
      "Your current password is wrong.",
    );
  });
});
