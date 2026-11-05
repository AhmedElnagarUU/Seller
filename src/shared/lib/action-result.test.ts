import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "@/shared/errors";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";

describe("validationFailure", () => {
  it("returns the first field message and all field errors", () => {
    const schema = z.object({
      name: z.string().min(2, "Use 2 or more characters."),
      email: z.string().min(5, "Enter an email."),
    });
    const result = schema.safeParse({ name: "A", email: "b" });

    const failure = validationFailure(result.error as z.ZodError);

    expect(failure).toEqual({
      ok: false,
      error: "Use 2 or more characters.",
      fieldErrors: { name: ["Use 2 or more characters."], email: ["Enter an email."] },
    });
  });
});

describe("failureFrom", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the message of an AppError", () => {
    expect(failureFrom(new AppError("CONFLICT", "This slug is already used."), "createThemeAction")).toEqual({
      ok: false,
      error: "This slug is already used.",
    });
  });

  it("hides other errors behind a generic message and logs them", () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const failure = failureFrom(new Error("database is down"), "createThemeAction");

    expect(failure).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
