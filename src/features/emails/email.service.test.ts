import { describe, expect, it } from "vitest";
import { sendVerifyEmail } from "@/features/emails/email.service";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";

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
