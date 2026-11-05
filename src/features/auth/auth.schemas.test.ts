import { describe, expect, it } from "vitest";
import { registerSchema, resetPasswordSchema } from "@/features/auth/auth.schemas";

describe("registerSchema", () => {
  it("lowercases the email and refuses country XX with invalidCountry", () => {
    const valid = registerSchema.safeParse({
      name: "Ann Lee",
      email: "  Ann@Example.COM ",
      password: "password123",
      country: "EG",
    });
    expect(valid.success).toBe(true);
    expect(valid.data?.email).toBe("ann@example.com");

    const invalid = registerSchema.safeParse({
      name: "Ann Lee",
      email: "ann@example.com",
      password: "password123",
      country: "XX",
    });
    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues.map((issue) => issue.message)).toEqual(["Please choose your country."]);
    expect(invalid.error?.issues[0]?.path).toEqual(["country"]);
  });
});

describe("resetPasswordSchema", () => {
  it("refuses different passwords with passwordsDiffer on confirmPassword", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "password123",
      confirmPassword: "password124",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
    expect(result.error?.issues[0]?.message).toBe("The passwords do not match.");
  });
});
