import { z } from "zod";
import type { ActionResult } from "@/shared/types/action";
import { AppError } from "@/shared/errors";

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

// Turns a zod error into an ActionResult. The top message is the first field message.
export function validationFailure(error: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string[]> = z.flattenError(error).fieldErrors;
  const firstMessage = Object.values(fieldErrors).flat()[0] ?? GENERIC_ERROR_MESSAGE;
  return { ok: false, error: firstMessage, fieldErrors };
}

// Turns an error caught in an action into an ActionResult. Only AppError messages are shown to the user.
export function failureFrom(error: unknown, actionName: string): ActionResult {
  if (error instanceof AppError) return { ok: false, error: error.message };
  console.error(`${actionName} failed`, error);
  return { ok: false, error: GENERIC_ERROR_MESSAGE };
}
