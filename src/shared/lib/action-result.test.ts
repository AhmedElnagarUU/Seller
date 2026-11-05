import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "@/shared/errors";
import { failureFrom, formKey, submittedValue, validationFailure } from "@/shared/lib/action-result";

describe("validationFailure", () => {
  it("returns the first field message and all field errors", () => {
    const schema = z.object({
      name: z.string().min(2, "Use 2 or more characters."),
      email: z.string().min(5, "Enter an email."),
    });
    const result = schema.safeParse({ name: "A", email: "b" });

    const failure = validationFailure(result.error as z.ZodError, { name: "A", email: "b" });

    expect(failure).toEqual({
      ok: false,
      error: "Use 2 or more characters.",
      fieldErrors: { name: ["Use 2 or more characters."], email: ["Enter an email."] },
      values: { name: "A", email: "b" },
    });
  });
});

describe("failureFrom", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the message of an AppError", () => {
    expect(
      failureFrom(new AppError("CONFLICT", "This slug is already used."), "createThemeAction", { name: "Aurora" }),
    ).toEqual({
      ok: false,
      error: "This slug is already used.",
      values: { name: "Aurora" },
    });
  });

  it("hides other errors behind a generic message and logs them", () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const failure = failureFrom(new Error("database is down"), "createThemeAction", { name: "Aurora" });

    expect(failure).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
      values: { name: "Aurora" },
    });
    expect(logError).toHaveBeenCalledTimes(1);
  });
});

describe("submittedValue", () => {
  it("returns what the user typed after a failure, and the initial value otherwise", () => {
    const failure = failureFrom(new AppError("INVALID", "Wrong."), "loginAction", { email: "ann@example.com" });

    expect(submittedValue(failure, "email", "")).toBe("ann@example.com");
    expect(submittedValue(failure, "name", "Saved name")).toBe("Saved name");
    expect(submittedValue(null, "email", "start")).toBe("start");
    expect(submittedValue({ ok: true, data: undefined }, "email", "start")).toBe("start");
    expect(formKey(failure)).not.toBe(formKey(null));
  });
});
