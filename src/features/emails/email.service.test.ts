import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import {
  buildAnnouncementEmail,
  buildFavoriteUpdateEmail,
  buildNewThemeInCategoryEmail,
  buildThemeUpdateEmail,
  sendAdminWalletReviewEmail,
  sendOrderConfirmationEmail,
  sendVerifyEmail,
  sendWalletApprovedEmail,
  sendWalletRejectedEmail,
} from "@/features/emails/email.service";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";
import { createCoupon, createOrder, createUser, createWalletPayment } from "@/shared/test/factories";

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

describe("wallet emails", () => {
  async function createPayment(overrides: Parameters<typeof createWalletPayment>[0] = {}) {
    const user = await createUser({ name: "Ann Lee", email: "ann@example.com", country: "EG" });
    return createWalletPayment({
      userId: user._id,
      referenceCode: "TS-ABCDEF",
      status: "submitted",
      senderPhone: "01012345678",
      ...overrides,
    });
  }

  it("sendWalletApprovedEmail › subject, 1,450 EGP, the reference, link /account/themes; no settings link; no /api/downloads/", async () => {
    const payment = await createPayment({ status: "approved" });

    await sendWalletApprovedEmail({ walletPaymentId: payment._id.toString() });

    expect(fakeEmailSender.sent).toHaveLength(1);
    const email = fakeEmailSender.sent[0];
    expect(email?.to).toBe("ann@example.com");
    expect(email?.subject).toBe(`Payment approved: ${payment.themeSnapshot.name} is yours`);
    expect(email?.templateName).toBe("WalletApprovedEmail");
    for (const part of [email?.html, email?.text]) {
      expect(part).toContain("Hi Ann Lee,");
      expect(part).toContain("1,450 EGP");
      expect(part).toContain("TS-ABCDEF");
      expect(part).toContain(payment.themeSnapshot.name);
      expect(part).toContain("with free updates for life.");
      expect(part).toContain("http://localhost:3000/account/themes");
      expect(part).toContain("Download your theme");
      expect(part).not.toContain("/account/settings");
      expect(part).not.toContain("/api/downloads/");
    }
  });

  it("sendWalletRejectedEmail › subject, the reason, link /account/wallet-payments/<id>", async () => {
    const payment = await createPayment({ status: "rejected", rejectionReason: "Money not received yet" });
    const id = payment._id.toString();

    await sendWalletRejectedEmail({ walletPaymentId: id });

    const email = fakeEmailSender.sent[0];
    expect(email?.to).toBe("ann@example.com");
    expect(email?.subject).toBe(`We could not confirm your payment for ${payment.themeSnapshot.name}`);
    expect(email?.templateName).toBe("WalletRejectedEmail");
    for (const part of [email?.html, email?.text]) {
      expect(part).toContain("Reason: Money not received yet");
      expect(part).toContain("TS-ABCDEF");
      expect(part).toContain("If you already sent the money, reply to this email with your transfer details");
      expect(part).toContain(`http://localhost:3000/account/wallet-payments/${id}`);
      expect(part).toContain("View payment");
      expect(part).not.toContain("/api/downloads/");
    }
  });

  it("sendAdminWalletReviewEmail › goes to admin@example.com with customer, amount, reference, sender phone and the review link", async () => {
    const payment = await createPayment();
    const id = payment._id.toString();

    await sendAdminWalletReviewEmail({ walletPaymentId: id });

    const email = fakeEmailSender.sent[0];
    expect(email?.to).toBe("admin@example.com");
    expect(email?.subject).toBe("New wallet payment to review: TS-ABCDEF");
    expect(email?.templateName).toBe("AdminWalletReviewEmail");
    for (const part of [email?.html, email?.text]) {
      expect(part).toContain("Ann Lee");
      expect(part).toContain("ann@example.com");
      expect(part).toContain("1,450 EGP");
      expect(part).toContain("TS-ABCDEF");
      expect(part).toContain("01012345678");
      expect(part).toContain(payment.themeSnapshot.name);
      expect(part).toContain("Check that the money arrived before approving.");
      expect(part).toContain(`http://localhost:3000/admin/wallet-payments/${id}`);
    }
  });

  it("an unknown payment → NOT_FOUND 'Payment request not found.'; nothing is sent", async () => {
    const unknownId = new Types.ObjectId().toString();

    for (const send of [sendWalletApprovedEmail, sendWalletRejectedEmail, sendAdminWalletReviewEmail]) {
      await expect(send({ walletPaymentId: unknownId })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Payment request not found.",
      });
    }

    expect(fakeEmailSender.sent).toHaveLength(0);
  });
});

const RELEASED_AT = new Date("2026-11-01T10:00:00Z");
const FIXED_CHANGE = { type: "fixed", text: "Fixed the footer" } as const;

describe("buildThemeUpdateEmail", () => {
  it("subject 'Aurora Blog 1.1.0 is available'; shows the version, the date, 'Fixed: Fixed the footer', the link, the reason and the settings link", async () => {
    const message = await buildThemeUpdateEmail({
      to: "ann@example.com",
      name: "Ann Lee",
      themeName: "Aurora Blog",
      version: "1.1.0",
      releasedAt: RELEASED_AT,
      changes: [FIXED_CHANGE],
    });

    expect(fakeEmailSender.sent).toHaveLength(0);
    expect(message.to).toBe("ann@example.com");
    expect(message.subject).toBe("Aurora Blog 1.1.0 is available");
    expect(message.templateName).toBe("ThemeUpdateEmail");
    for (const part of [message.html, message.text]) {
      expect(part).toContain("Hi Ann Lee,");
      expect(part).toContain("Aurora Blog");
      expect(part).toContain("1.1.0");
      expect(part).toContain("Nov 1, 2026");
      expect(part).toContain("What changed:");
      expect(part).toContain("Fixed: Fixed the footer");
      expect(part).toContain("Download the update");
      expect(part).toContain("http://localhost:3000/account/themes");
      expect(part).toContain("You get this email because you own Aurora Blog.");
      expect(part).toContain("Change your email settings: http://localhost:3000/account/settings");
    }
  });

  it("lists at most 10 changes, then '…and 2 more changes.' for 12 changes", async () => {
    const changes = Array.from({ length: 12 }, (_, index) => ({
      type: "improved" as const,
      text: `Change number ${index + 1}`,
    }));

    const message = await buildThemeUpdateEmail({
      to: "ann@example.com",
      name: "Ann Lee",
      themeName: "Aurora Blog",
      version: "1.1.0",
      releasedAt: RELEASED_AT,
      changes,
    });

    for (const part of [message.html, message.text]) {
      expect(part).toContain("Improved: Change number 1");
      expect(part).toContain("Improved: Change number 10");
      expect(part).not.toContain("Change number 11");
      expect(part).toContain("…and 2 more changes.");
    }
  });
});

describe("buildFavoriteUpdateEmail", () => {
  it("subject 'Aurora Blog 1.1.0 is out', link http://localhost:3000/themes/<slug>, reason 'you favorited Aurora Blog'", async () => {
    const message = await buildFavoriteUpdateEmail({
      to: "ann@example.com",
      name: "Ann Lee",
      themeName: "Aurora Blog",
      themeSlug: "aurora-blog",
      version: "1.1.0",
      changes: [FIXED_CHANGE],
    });

    expect(message.subject).toBe("Aurora Blog 1.1.0 is out");
    expect(message.templateName).toBe("ThemeUpdateEmail");
    for (const part of [message.html, message.text]) {
      expect(part).toContain("a theme you favorited, has a new version");
      expect(part).toContain("Fixed: Fixed the footer");
      expect(part).toContain("See the theme");
      expect(part).toContain("http://localhost:3000/themes/aurora-blog");
      expect(part).toContain("You get this email because you favorited Aurora Blog.");
      expect(part).toContain("http://localhost:3000/account/settings");
    }
  });
});

describe("buildNewThemeInCategoryEmail", () => {
  it("subject 'New in Blog: Aurora Blog'; contains the tagline and the settings link", async () => {
    const message = await buildNewThemeInCategoryEmail({
      to: "ann@example.com",
      name: "Ann Lee",
      categoryName: "Blog",
      themeName: "Aurora Blog",
      themeSlug: "aurora-blog",
      tagline: "A calm theme for writers",
    });

    expect(message.subject).toBe("New in Blog: Aurora Blog");
    expect(message.templateName).toBe("NewThemeInCategoryEmail");
    for (const part of [message.html, message.text]) {
      expect(part).toContain("A new theme was just added to");
      expect(part).toContain("A calm theme for writers");
      expect(part).toContain("http://localhost:3000/themes/aurora-blog");
      expect(part).toContain("You get this email because you follow Blog.");
      expect(part).toContain("http://localhost:3000/account/settings");
    }
  });
});

describe("buildAnnouncementEmail", () => {
  it("subject is the title; keeps the two lines of a two-line body; with a link the button points to the absolute link, without a link there is no 'Learn more' button", async () => {
    const withLink = await buildAnnouncementEmail({
      to: "ann@example.com",
      name: "Ann Lee",
      title: "Big sale",
      body: "First line of the news.\nSecond line of the news.",
      link: "/themes",
    });
    const withoutLink = await buildAnnouncementEmail({
      to: "ann@example.com",
      name: "Ann Lee",
      title: "Big sale",
      body: "First line of the news.\nSecond line of the news.",
      link: null,
    });

    expect(withLink.subject).toBe("Big sale");
    expect(withLink.templateName).toBe("AnnouncementEmail");
    expect(withLink.html).toMatch(/>First line of the news\.<\/p>/);
    expect(withLink.html).toMatch(/>Second line of the news\.<\/p>/);
    expect(withLink.text).toContain("First line of the news.");
    expect(withLink.text).toContain("Second line of the news.");
    for (const part of [withLink.html, withLink.text]) {
      expect(part).toContain("Learn more");
      expect(part).toContain("http://localhost:3000/themes");
      expect(part).toContain("You get this email because you are a customer of Theme Store.");
      expect(part).toContain("http://localhost:3000/account/settings");
    }
    for (const part of [withoutLink.html, withoutLink.text]) {
      expect(part).not.toContain("Learn more");
      expect(part).toContain("First line of the news.");
    }
  });
});

describe("the optional emails and the payment emails", () => {
  it("the four builders contain the settings link; the four payment emails do not; no email contains /api/downloads/", async () => {
    const optional = [
      await buildThemeUpdateEmail({
        to: "ann@example.com",
        name: "Ann Lee",
        themeName: "Aurora Blog",
        version: "1.1.0",
        releasedAt: RELEASED_AT,
        changes: [FIXED_CHANGE],
      }),
      await buildFavoriteUpdateEmail({
        to: "ann@example.com",
        name: "Ann Lee",
        themeName: "Aurora Blog",
        themeSlug: "aurora-blog",
        version: "1.1.0",
        changes: [FIXED_CHANGE],
      }),
      await buildNewThemeInCategoryEmail({
        to: "ann@example.com",
        name: "Ann Lee",
        categoryName: "Blog",
        themeName: "Aurora Blog",
        themeSlug: "aurora-blog",
        tagline: "A calm theme for writers",
      }),
      await buildAnnouncementEmail({
        to: "ann@example.com",
        name: "Ann Lee",
        title: "Big sale",
        body: "Everything is cheaper this week.",
        link: "/themes",
      }),
    ];
    const user = await createUser({ country: "EG" });
    const order = await createOrder({ userId: user._id });
    const payment = await createWalletPayment({
      userId: user._id,
      status: "rejected",
      rejectionReason: "Money not received yet",
    });
    await sendOrderConfirmationEmail({ orderId: order._id.toString() });
    await sendWalletApprovedEmail({ walletPaymentId: payment._id.toString() });
    await sendWalletRejectedEmail({ walletPaymentId: payment._id.toString() });
    await sendAdminWalletReviewEmail({ walletPaymentId: payment._id.toString() });

    expect(fakeEmailSender.sent).toHaveLength(4);
    for (const message of optional) {
      expect(message.html).toContain("http://localhost:3000/account/settings");
      expect(message.text).toContain("http://localhost:3000/account/settings");
    }
    for (const message of [...optional, ...fakeEmailSender.sent]) {
      expect(message.html).not.toContain("/api/downloads/");
      expect(message.text).not.toContain("/api/downloads/");
    }
    for (const message of fakeEmailSender.sent) {
      expect(message.html).not.toContain("/account/settings");
      expect(message.text).not.toContain("/account/settings");
    }
  });
});
