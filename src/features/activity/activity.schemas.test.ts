import { describe, expect, it } from "vitest";
import { activitySearchParamsSchema } from "@/features/activity/activity.schemas";

describe("activitySearchParamsSchema", () => {
  it("keeps a valid action and a trimmed customer", () => {
    const parsed = activitySearchParamsSchema.parse({
      action: "order_paid",
      customer: "  ann@example.com ",
      page: "3",
    });

    expect(parsed).toEqual({ action: "order_paid", customer: "ann@example.com", page: 3 });
  });

  it("falls back for a bad action, `page=0` and `page=abc`", () => {
    const withZero = activitySearchParamsSchema.parse({ action: "hacked", customer: "", page: "0" });
    const withText = activitySearchParamsSchema.parse({ action: ["order_paid", "x"], customer: "", page: "abc" });

    expect(withZero.action).toBeUndefined();
    expect(withZero.page).toBe(1);
    expect(withText.action).toBeUndefined();
    expect(withText.page).toBe(1);
  });
});
