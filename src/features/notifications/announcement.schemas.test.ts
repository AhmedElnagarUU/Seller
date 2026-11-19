import { describe, expect, it } from "vitest";
import { announcementInputSchema } from "@/features/notifications/announcement.schemas";

const THEME_ID = "665f1c2e8f1b2c3d4e5f6a7b";

function input(overrides: Record<string, unknown> = {}) {
  return {
    title: "Winter sale",
    body: "All themes are 20% off.",
    link: "",
    audience: "all_customers",
    themeId: "",
    customerEmail: "",
    sendEmail: false,
    ...overrides,
  };
}

function messagesOf(result: ReturnType<typeof announcementInputSchema.safeParse>) {
  return result.error?.issues.map((issue) => [issue.path[0], issue.message]);
}

describe("announcementInputSchema", () => {
  it("applies the field rules", () => {
    const valid = announcementInputSchema.safeParse(input({ title: "  Hi  ", link: "/themes" }));
    const tooShort = announcementInputSchema.safeParse(input({ title: "a" }));
    const tooLong = announcementInputSchema.safeParse(input({ title: "a".repeat(121) }));
    const longest = announcementInputSchema.safeParse(input({ title: "a".repeat(120), body: "b".repeat(1000) }));
    const bodyTooLong = announcementInputSchema.safeParse(input({ body: "b".repeat(1001) }));
    const emptyLink = announcementInputSchema.safeParse(input({ link: "   " }));
    const doubleSlash = announcementInputSchema.safeParse(input({ link: "//evil.com" }));
    const absolute = announcementInputSchema.safeParse(input({ link: "https://x.com" }));
    const longLink = announcementInputSchema.safeParse(input({ link: `/${"a".repeat(300)}` }));

    const ownersWithoutTheme = announcementInputSchema.safeParse(input({ audience: "theme_owners" }));
    const unusedFields = announcementInputSchema.safeParse(
      input({ themeId: THEME_ID, customerEmail: "ann@example.com" }),
    );

    expect(messagesOf(ownersWithoutTheme)).toEqual([["themeId", "Choose a theme."]]);
    expect(unusedFields.success && [unusedFields.data.themeId, unusedFields.data.customerEmail]).toEqual([null, null]);
    expect(valid.success && valid.data.title).toBe("Hi");
    expect(valid.success && valid.data.link).toBe("/themes");
    expect(messagesOf(tooShort)).toEqual([["title", "Use 2 to 120 characters."]]);
    expect(messagesOf(tooLong)).toEqual([["title", "Use 2 to 120 characters."]]);
    expect(longest.success).toBe(true);
    expect(messagesOf(bodyTooLong)).toEqual([["body", "Use 2 to 1 000 characters."]]);
    expect(emptyLink.success && emptyLink.data.link).toBeNull();
    expect(messagesOf(doubleSlash)).toEqual([["link", "Enter a path that starts with / (for example /themes)."]]);
    expect(messagesOf(absolute)).toEqual([["link", "Enter a path that starts with / (for example /themes)."]]);
    expect(messagesOf(longLink)).toEqual([["link", "Enter a path that starts with / (for example /themes)."]]);
  });

  it("checks the fields of the chosen audience and drops the others", () => {
    const noTheme = announcementInputSchema.safeParse(input({ audience: "theme_owners" }));
    const badTheme = announcementInputSchema.safeParse(input({ audience: "theme_owners", themeId: "x" }));
    const noEmail = announcementInputSchema.safeParse(input({ audience: "one_customer" }));
    const badAudience = announcementInputSchema.safeParse(input({ audience: "everyone" }));
    const allCustomers = announcementInputSchema.safeParse(
      input({ themeId: THEME_ID, customerEmail: "ann@example.com", sendEmail: true }),
    );
    const owners = announcementInputSchema.safeParse(
      input({ audience: "theme_owners", themeId: THEME_ID, customerEmail: "ann@example.com" }),
    );
    const oneCustomer = announcementInputSchema.safeParse(
      input({ audience: "one_customer", themeId: THEME_ID, customerEmail: "  Ann@Example.com " }),
    );

    expect(messagesOf(noTheme)).toEqual([["themeId", "Choose a theme."]]);
    expect(messagesOf(badTheme)).toEqual([["themeId", "Choose a theme."]]);
    expect(messagesOf(noEmail)).toEqual([["customerEmail", "No customer with this email."]]);
    expect(messagesOf(badAudience)).toEqual([["audience", "Choose who gets this announcement."]]);
    expect(allCustomers.success && allCustomers.data).toEqual({
      title: "Winter sale",
      body: "All themes are 20% off.",
      link: null,
      audience: "all_customers",
      themeId: null,
      customerEmail: null,
      sendEmail: true,
    });
    expect(owners.success && [owners.data.themeId, owners.data.customerEmail]).toEqual([THEME_ID, null]);
    expect(oneCustomer.success && [oneCustomer.data.themeId, oneCustomer.data.customerEmail]).toEqual([
      null,
      "Ann@Example.com",
    ]);
  });
});
