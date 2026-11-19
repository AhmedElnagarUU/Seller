import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { sendOrderConfirmationEmail, sendVerifyEmail } from "@/features/emails/email.service";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";
import { createCoupon, createOrder, createUser } from "@/shared/test/factories";

describe("sendVerifyEmail", () => {
  it("sends subject 'Confirm your email address' with the name and URL in both html and text", async () => {
    await sendVerifyEmail({ to: "ann@example.com", name: "Ann Lee", url: "http://localhost:3000/verify?token=abc" });

    expect(fakeEmailSender.sent).toHaveLength(1);
    const email = fakeEmailSender.sent[0];
    expect(email?.to).toBe("ann@example.com");
    expect(email?.subject).toBe("Confirm your email address");
    expect(email?.templateName).toBe("VerifyEmail");
    expect(email?.html).toContain("Hi Ann Lee,");
    expect(email?.html).toContain("http://localhost:3000/verify?token=abc");
    expect(email?.text).toContain("Hi Ann Lee,");
    expect(email?.text).toContain("http://localhost:3000/verify?token=abc");
  });
});

describe("sendOrderConfirmationEmail", () => {
  it("sends subject 'Your purchase: <Theme>' to the buyer with the theme name, the total, the order id and the absolute link", async () => {
    const user = await createUser({ name: "Ann Lee", email: "ann@example.com" });
    const order = await createOrder({
      userId: user._id,
      totalAmount: 2320,
      discountAmount: 580,
      paidAt: new Date("2026-11-01T10:00:00Z"),
    });

    await sendOrderConfirmationEmail({ orderId: order._id.toString() });

    expect(fakeEmailSender.sent).toHaveLength(1);
    const email = fakeEmailSender.sent[0];
    expect(email?.to).toBe("ann@example.com");
    expect(email?.subject).toBe(`Your purchase: ${order.themeSnapshot.name}`);
    expect(email?.templateName).toBe("OrderConfirmationEmail");
    for (const part of [email?.html, email?.text]) {
      expect(part).toContain("Hi Ann Lee,");
      expect(part).toContain(order.themeSnapshot.name);
      expect(part).toContain("It is now in your account, with free updates for life.");
      expect(part).toContain("$23.20");
      expect(part).toContain(order._id.toString());
      expect(part).toContain("Nov 1, 2026");
      expect(part).toContain("http://localhost:3000/account/themes");
      expect(part).toContain("Download your theme");
      expect(part).toContain("Your receipt from our payment partner Polar was sent in a separate email.");
    }
  });

  it("shows the coupon line 'Coupon SAVE20: −$5.80' only when there was a discount", async () => {
    const coupon = await createCoupon({ code: "SAVE20" });
    const discounted = await createOrder({
      couponId: coupon._id,
      couponCode: "SAVE20",
      discountAmount: 580,
      totalAmount: 2320,
    });
    const full = await createOrder();

    await sendOrderConfirmationEmail({ orderId: discounted._id.toString() });
    await sendOrderConfirmationEmail({ orderId: full._id.toString() });

    const [withCoupon, withoutCoupon] = fakeEmailSender.sent;
    expect(withCoupon?.html).toContain("Coupon SAVE20: −$5.80");
    expect(withCoupon?.text).toContain("Coupon SAVE20: −$5.80");
    expect(withoutCoupon?.html).not.toContain("Coupon");
    expect(withoutCoupon?.text).not.toContain("Coupon");
  });

  it("contains no /api/downloads/ and no settings link", async () => {
    const order = await createOrder();

    await sendOrderConfirmationEmail({ orderId: order._id.toString() });

    const email = fakeEmailSender.sent[0];
    for (const part of [email?.html, email?.text]) {
      expect(part).not.toContain("/api/downloads/");
      expect(part).not.toContain("/account/settings");
    }
  });

  it("throws NOT_FOUND 'Order not found.' for an unknown order and for an order of an unknown user", async () => {
    const orphan = await createOrder({ userId: new Types.ObjectId() });

    await expect(sendOrderConfirmationEmail({ orderId: new Types.ObjectId().toString() })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Order not found.",
    });
    await expect(sendOrderConfirmationEmail({ orderId: orphan._id.toString() })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Order not found.",
    });
    expect(fakeEmailSender.sent).toHaveLength(0);
  });
});
