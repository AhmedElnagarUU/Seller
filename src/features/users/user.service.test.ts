import { describe, expect, it } from "vitest";
import { UserModel } from "@/features/users/user.model";
import { isAdminEmail, setUserCountry } from "@/features/users/user.service";

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
