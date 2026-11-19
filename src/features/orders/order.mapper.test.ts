import { describe, expect, it } from "vitest";
import { toOrderEmailDTO, toOrderListItemDTO, toOrderSuccessDTO } from "@/features/orders/order.mapper";
import { createCoupon, createOrder } from "@/shared/test/factories";

describe("order mappers", () => {
  it("toOrderListItemDTO copies the snapshot name and slug, the method, status and total", async () => {
    const order = await createOrder({ totalAmount: 2320, status: "partially_refunded" });

    expect(toOrderListItemDTO(order)).toEqual({
      id: order._id.toString(),
      paidAt: order.paidAt,
      themeName: order.themeSnapshot.name,
      themeSlug: order.themeSnapshot.slug,
      method: "card",
      status: "partially_refunded",
      totalAmount: 2320,
      currency: "usd",
    });
  });

  it("toOrderSuccessDTO gives the ids and the theme snapshot", async () => {
    const order = await createOrder();

    expect(toOrderSuccessDTO(order)).toEqual({
      id: order._id.toString(),
      themeId: order.themeId.toString(),
      themeName: order.themeSnapshot.name,
      themeSlug: order.themeSnapshot.slug,
    });
  });

  it("toOrderEmailDTO gives the amounts and the coupon code (null without a coupon)", async () => {
    const coupon = await createCoupon({ code: "SAVE20" });
    const withCoupon = await createOrder({ couponId: coupon._id, couponCode: "SAVE20", discountAmount: 580 });
    const withoutCoupon = await createOrder();

    expect(toOrderEmailDTO(withCoupon)).toEqual({
      id: withCoupon._id.toString(),
      userId: withCoupon.userId.toString(),
      themeName: withCoupon.themeSnapshot.name,
      paidAt: withCoupon.paidAt,
      totalAmount: 2900,
      discountAmount: 580,
      currency: "usd",
      couponCode: "SAVE20",
    });
    expect(toOrderEmailDTO(withoutCoupon).couponCode).toBeNull();
  });
});
