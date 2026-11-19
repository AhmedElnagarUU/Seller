import { describe, expect, it } from "vitest";
import { adminOrderSearchParamsSchema, markRefundedSchema } from "@/features/orders/order-admin.schemas";

describe("adminOrderSearchParamsSchema", () => {
  it("keeps valid values and falls back for bad ones", () => {
    expect(
      adminOrderSearchParamsSchema.parse({
        method: "card",
        status: "refunded",
        from: "2026-11-01",
        to: "2026-11-05",
        page: "2",
      }),
    ).toEqual({ method: "card", status: "refunded", from: "2026-11-01", to: "2026-11-05", page: 2 });

    expect(
      adminOrderSearchParamsSchema.parse({ method: "x", status: "y", from: "2026-02-31", to: "abc", page: "0" }),
    ).toEqual({ method: undefined, status: undefined, from: undefined, to: undefined, page: 1 });
    expect(adminOrderSearchParamsSchema.parse({})).toEqual({
      method: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
      page: 1,
    });
  });
});

describe("markRefundedSchema", () => {
  it("accepts an order id and refuses anything else", () => {
    expect(markRefundedSchema.parse({ orderId: " 665f1c2e8f1b2c3d4e5f6a7b " }).orderId).toBe(
      "665f1c2e8f1b2c3d4e5f6a7b",
    );
    const result = markRefundedSchema.safeParse({ orderId: "nope" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Not found.");
  });
});
