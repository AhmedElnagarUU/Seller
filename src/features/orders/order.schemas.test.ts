import { describe, expect, it } from "vitest";
import { orderListSearchParamsSchema } from "@/features/orders/order.schemas";

describe("orderListSearchParamsSchema", () => {
  it("keeps a valid page", () => {
    expect(orderListSearchParamsSchema.parse({ page: "3" }).page).toBe(3);
  });

  it("turns a page below 1 or not a number into 1", () => {
    expect(orderListSearchParamsSchema.parse({ page: "0" }).page).toBe(1);
    expect(orderListSearchParamsSchema.parse({ page: "-4" }).page).toBe(1);
    expect(orderListSearchParamsSchema.parse({ page: "abc" }).page).toBe(1);
    expect(orderListSearchParamsSchema.parse({ page: "1.5" }).page).toBe(1);
    expect(orderListSearchParamsSchema.parse({}).page).toBe(1);
  });
});
