import { describe, expect, it } from "vitest";
import { loginAction, registerAction } from "@/features/auth/auth.actions";

describe("auth actions after a validation error", () => {
  it("send back the typed text but never the password (login)", async () => {
    const formData = new FormData();
    formData.set("email", "ann@example.com");
    formData.set("password", "");

    const result = await loginAction(null, formData);

    expect(result).toMatchObject({ ok: false, values: { email: "ann@example.com" } });
    expect(JSON.stringify(result)).not.toContain('password":"');
  });

  it("send back name, email and country but never the password (register)", async () => {
    const formData = new FormData();
    formData.set("name", "Ann Lee");
    formData.set("email", "ann@example.com");
    formData.set("country", "EG");
    formData.set("password", "short");

    const result = await registerAction(null, formData);

    expect(result).toMatchObject({
      ok: false,
      values: { name: "Ann Lee", email: "ann@example.com", country: "EG" },
    });
    expect(JSON.stringify(result)).not.toContain("short");
  });
});
