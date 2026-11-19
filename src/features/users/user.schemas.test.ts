import { describe, expect, it } from "vitest";
import { customerSearchParamsSchema, disableCustomerSchema } from "@/features/users/user.schemas";

const ID = "665f1c2e8f1b2c3d4e5f6a7b";

describe("disableCustomerSchema", () => {
  it("requires a reason of 1 to 300 characters", () => {
    const empty = disableCustomerSchema.safeParse({ id: ID, reason: "   " });
    const tooLong = disableCustomerSchema.safeParse({ id: ID, reason: "r".repeat(301) });
    const longest = disableCustomerSchema.safeParse({ id: ID, reason: "r".repeat(300) });
    const trimmed = disableCustomerSchema.safeParse({ id: ID, reason: "  Spam  " });

    expect(empty.success).toBe(false);
    expect(empty.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ["reason", "Write a reason (1 to 300 characters)."],
    ]);
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ["reason", "Write a reason (1 to 300 characters)."],
    ]);
    expect(longest.success && longest.data.reason).toBe("r".repeat(300));
    expect(trimmed.success && trimmed.data).toEqual({ id: ID, reason: "Spam" });
  });

  it("refuses an id that is not 24 hex characters", () => {
    const result = disableCustomerSchema.safeParse({ id: "abc", reason: "Spam" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ["id", "Customer not found."],
    ]);
  });
});

describe("customerSearchParamsSchema", () => {
  it("falls back to no search, all customers and page 1 for bad values", () => {
    expect(customerSearchParamsSchema.parse({ q: "x".repeat(81), status: "other", page: "0" })).toEqual({
      q: "",
      status: undefined,
      page: 1,
    });
    expect(customerSearchParamsSchema.parse({ q: "  ann ", status: "disabled", page: "3" })).toEqual({
      q: "ann",
      status: "disabled",
      page: 3,
    });
  });
});
