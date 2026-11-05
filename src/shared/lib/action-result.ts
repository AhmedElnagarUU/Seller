import { z } from "zod";
import type { ActionResult } from "@/shared/types/action";
import { AppError } from "@/shared/errors";

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

// The text fields of a submitted form, sent back so the form can show them again. Never put passwords in it.
export type SubmittedValues = Record<string, string>;

// Turns a zod error into an ActionResult. The top message is the first field message.
export function validationFailure(error: z.ZodError, values: SubmittedValues): ActionResult {
  const fieldErrors: Record<string, string[]> = z.flattenError(error).fieldErrors;
  const firstMessage = Object.values(fieldErrors).flat()[0] ?? GENERIC_ERROR_MESSAGE;
  return { ok: false, error: firstMessage, fieldErrors, values };
}

// Turns an error caught in an action into an ActionResult. Only AppError messages are shown to the user.
export function failureFrom(error: unknown, actionName: string, values: SubmittedValues): ActionResult {
  if (error instanceof AppError) return { ok: false, error: error.message, values };
  console.error(`${actionName} failed`, error);
  return { ok: false, error: GENERIC_ERROR_MESSAGE, values };
}

// The value a form field should start with: what the user typed before a failure, otherwise `initial`.
export function submittedValue(state: ActionResult | null, key: string, initial: string): string {
  if (state?.ok === false && state.values) return state.values[key] ?? initial;
  return initial;
}

// Changes after every action result, so the form is rebuilt with the values above as its defaults.
export function formKey(state: ActionResult | null): string {
  return JSON.stringify(state);
}
