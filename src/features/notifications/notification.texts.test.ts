import { describe, expect, it } from "vitest";
import {
  buildAnnouncementText,
  buildCategoryNewThemeText,
  buildFavoriteThemeUpdatedText,
  buildFeedbackReplyText,
  buildOwnedThemeUpdatedText,
  buildWalletPaymentApprovedText,
  buildWalletPaymentRejectedText,
} from "@/features/notifications/notification.texts";

const UPDATE_INPUT = { themeName: "Aurora Blog", version: "1.4.0", changeTexts: ["Fixed the footer"] };

describe("buildOwnedThemeUpdatedText", () => {
  it("builds title and link", () => {
    const text = buildOwnedThemeUpdatedText(UPDATE_INPUT);

    expect(text.title).toBe("Aurora Blog 1.4.0 is available");
    expect(text.link).toBe("/account/themes");
  });
});

describe("buildFavoriteThemeUpdatedText", () => {
  it("builds title and link", () => {
    const text = buildFavoriteThemeUpdatedText({ ...UPDATE_INPUT, themeSlug: "aurora-blog" });

    expect(text.title).toBe("Aurora Blog 1.4.0 is out");
    expect(text.link).toBe("/themes/aurora-blog");
  });
});

describe("update notifications", () => {
  it("body with one change is that change", () => {
    expect(buildOwnedThemeUpdatedText(UPDATE_INPUT).body).toBe("Fixed the footer");
    expect(buildFavoriteThemeUpdatedText({ ...UPDATE_INPUT, themeSlug: "aurora-blog" }).body).toBe("Fixed the footer");
  });

  it("body with more changes", () => {
    const changeTexts = ["Fixed the footer", "Added dark mode", "New header"];
    const longChange = "b".repeat(250);

    const shortBody = buildOwnedThemeUpdatedText({ ...UPDATE_INPUT, changeTexts }).body;
    const favoriteBody = buildFavoriteThemeUpdatedText({ ...UPDATE_INPUT, themeSlug: "aurora-blog", changeTexts }).body;
    const longBody = buildOwnedThemeUpdatedText({ ...UPDATE_INPUT, changeTexts: [longChange, "Second"] }).body;

    expect(shortBody).toBe("Fixed the footer + 2 more");
    expect(favoriteBody).toBe("Fixed the footer + 2 more");
    expect(longBody).toBe(`${"b".repeat(199)}… + 1 more`);
    expect(longBody.indexOf("…")).toBe(199);
  });
});

describe("buildCategoryNewThemeText", () => {
  it("builds title, body and link", () => {
    const text = buildCategoryNewThemeText({
      categoryName: "Blog",
      themeName: "Aurora Blog",
      themeSlug: "aurora-blog",
      tagline: "A calm theme for writers",
    });

    expect(text).toEqual({
      title: "New in Blog: Aurora Blog",
      body: "A calm theme for writers",
      link: "/themes/aurora-blog",
    });
  });
});

describe("buildAnnouncementText", () => {
  it("keeps title and body and gives link null without a link; keeps the link when given", () => {
    const withoutLink = buildAnnouncementText({ title: "Winter sale", body: "All themes are 20% off.", link: null });
    const withLink = buildAnnouncementText({ title: "Winter sale", body: "All themes are 20% off.", link: "/themes" });

    expect(withoutLink).toEqual({ title: "Winter sale", body: "All themes are 20% off.", link: null });
    expect(withLink).toEqual({ title: "Winter sale", body: "All themes are 20% off.", link: "/themes" });
  });
});

describe("buildWalletPaymentApprovedText", () => {
  it("says the amount", () => {
    const text = buildWalletPaymentApprovedText({ themeName: "Aurora Blog", amountEgp: 1465 });

    expect(text).toEqual({
      title: "Payment approved: Aurora Blog",
      body: "Your payment of 1,465 EGP was confirmed. You can download the theme now.",
      link: "/account/themes",
    });
  });
});

describe("buildWalletPaymentRejectedText", () => {
  it("links to the payment", () => {
    const text = buildWalletPaymentRejectedText({
      themeName: "Aurora Blog",
      rejectionReason: "The amount was wrong.",
      walletPaymentId: "665f1c2e8f1b2c3d4e5f6a7b",
    });

    expect(text).toEqual({
      title: "Payment not confirmed: Aurora Blog",
      body: "Reason: The amount was wrong.",
      link: "/account/wallet-payments/665f1c2e8f1b2c3d4e5f6a7b",
    });
  });
});

describe("buildFeedbackReplyText", () => {
  it("title is fixed and body is the subject", () => {
    const text = buildFeedbackReplyText({ subject: "Question about updates" });

    expect(text).toEqual({
      title: "Reply to your feedback",
      body: "Question about updates",
      link: "/account/feedback",
    });
  });
});

describe("cutting", () => {
  it("cuts a title over 120 characters and ends it with …", () => {
    const text = buildAnnouncementText({ title: "a".repeat(130), body: "Body", link: null });

    expect(text.title).toHaveLength(120);
    expect(text.title).toBe(`${"a".repeat(119)}…`);
  });

  it("keeps a title of exactly 120 characters", () => {
    const title = "a".repeat(120);

    expect(buildAnnouncementText({ title, body: "Body", link: null }).title).toBe(title);
  });

  it("cuts a body over 1 000 characters", () => {
    const text = buildAnnouncementText({ title: "Title", body: "b".repeat(1001), link: "/themes" });

    expect(text.body).toHaveLength(1000);
    expect(text.body).toBe(`${"b".repeat(999)}…`);
    expect(text.body.endsWith("…")).toBe(true);
    expect(text.link).toBe("/themes");
  });
});
