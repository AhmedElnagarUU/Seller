import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import {
  getOrderForCheckout,
  getOrderForEmail,
  getRefundBase,
  listOrdersForUser,
} from "@/features/orders/order.service";
import { createOrder, createUser } from "@/shared/test/factories";

describe("listOrdersForUser", () => {
  it("returns only the user's orders, newest first", async () => {
    const user = await createUser();
    const other = await createUser();
    const first = await createOrder({ userId: user._id, createdAt: new Date("2026-11-01T10:00:00Z") });
    const second = await createOrder({ userId: user._id, createdAt: new Date("2026-11-02T10:00:00Z") });
    await createOrder({ userId: other._id });

    const page = await listOrdersForUser(user._id.toString(), 1);

    expect(page.items.map((item) => item.id)).toEqual([second._id.toString(), first._id.toString()]);
    expect(page).toMatchObject({ page: 1, totalPages: 1, total: 2 });
    expect(page.items[0]).toMatchObject({
      themeName: second.themeSnapshot.name,
      themeSlug: second.themeSnapshot.slug,
      method: "card",
      status: "paid",
      totalAmount: 2900,
      currency: "usd",
    });
  });

  it("25 orders: page 1 has 20, page 2 has 5, totalPages 2; a page above totalPages is empty", async () => {
    const user = await createUser();
    for (let index = 0; index < 25; index += 1) {
      await createOrder({ userId: user._id });
    }

    const pageOne = await listOrdersForUser(user._id.toString(), 1);
    const pageTwo = await listOrdersForUser(user._id.toString(), 2);
    const pageThree = await listOrdersForUser(user._id.toString(), 3);
    const pageZero = await listOrdersForUser(user._id.toString(), 0);

    expect(pageOne.items).toHaveLength(20);
    expect(pageTwo.items).toHaveLength(5);
    expect(pageOne.totalPages).toBe(2);
    expect(pageOne.total).toBe(25);
    expect(pageThree.items).toEqual([]);
    expect(pageThree.page).toBe(3);
    expect(pageZero.page).toBe(1);
    expect(pageZero.items.map((item) => item.id)).toEqual(pageOne.items.map((item) => item.id));
  });

  it("gives an empty page for an invalid user id", async () => {
    expect(await listOrdersForUser("not-an-id", 1)).toEqual({ items: [], page: 1, totalPages: 0, total: 0 });
  });
});

describe("getOrderForCheckout", () => {
  it("returns the order for its owner and null for another user or an unknown checkout id", async () => {
    const user = await createUser();
    const other = await createUser();
    const order = await createOrder({
      userId: user._id,
      provider: { name: "polar", orderId: "po_1", checkoutId: "chk_1", customerId: null },
    });

    expect(await getOrderForCheckout(user._id.toString(), "chk_1")).toEqual({
      id: order._id.toString(),
      themeId: order.themeId.toString(),
      themeName: order.themeSnapshot.name,
      themeSlug: order.themeSnapshot.slug,
    });
    expect(await getOrderForCheckout(other._id.toString(), "chk_1")).toBeNull();
    expect(await getOrderForCheckout(user._id.toString(), "chk_unknown")).toBeNull();
    expect(await getOrderForCheckout("not-an-id", "chk_1")).toBeNull();
  });
});

describe("getOrderForEmail", () => {
  it("returns the order data and null for an invalid or unknown id", async () => {
    const order = await createOrder({ totalAmount: 2320, discountAmount: 580 });

    const found = await getOrderForEmail(order._id.toString());

    expect(found).toMatchObject({
      id: order._id.toString(),
      userId: order.userId.toString(),
      themeName: order.themeSnapshot.name,
      totalAmount: 2320,
      discountAmount: 580,
      currency: "usd",
      couponCode: null,
    });
    expect(await getOrderForEmail("not-an-id")).toBeNull();
    expect(await getOrderForEmail(new Types.ObjectId().toString())).toBeNull();
  });
});

describe("getRefundBase", () => {
  it("returns the total of the order of a provider and null for an unknown order", async () => {
    await createOrder({
      totalAmount: 2320,
      provider: { name: "fake", orderId: "fake_ord_1", checkoutId: null, customerId: null },
    });

    expect(await getRefundBase("fake", "fake_ord_1")).toBe(2320);
    expect(await getRefundBase("polar", "fake_ord_1")).toBeNull();
    expect(await getRefundBase("fake", "unknown")).toBeNull();
  });
});
