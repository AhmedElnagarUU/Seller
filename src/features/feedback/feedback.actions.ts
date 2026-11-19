"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readText } from "@/shared/lib/form-data";
import { requireAdmin, requireUser } from "@/features/auth/session";
import { FEEDBACK_MESSAGES, FEEDBACK_SENT_MESSAGE } from "@/features/feedback/feedback.constants";
import { feedbackIdSchema, feedbackInputSchema, feedbackReplySchema } from "@/features/feedback/feedback.schemas";
import { reopenFeedback, replyToFeedback, resolveFeedback, sendFeedback } from "@/features/feedback/feedback.service";

function revalidateFeedbackPages(): void {
  revalidatePath("/account/feedback");
  revalidatePath("/admin/feedback");
  revalidatePath("/admin/feedback/[id]", "page");
  revalidatePath("/admin", "layout");
}

export async function sendFeedbackAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser("/account/feedback");
  const values = { subject: readText(formData, "subject"), message: readText(formData, "message") };
  const parsed = feedbackInputSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await sendFeedback(user.id, parsed.data);
  } catch (error) {
    return failureFrom(error, "sendFeedbackAction", values);
  }
  revalidatePath("/account/feedback");
  revalidatePath("/admin/feedback");
  revalidatePath("/admin", "layout");
  return { ok: true, data: undefined, message: FEEDBACK_SENT_MESSAGE };
}

export async function replyToFeedbackAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const values = { reply: readText(formData, "reply") };
  const parsed = feedbackReplySchema.safeParse({ id: readText(formData, "id"), reply: values.reply });
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await replyToFeedback(parsed.data.id, parsed.data.reply, admin.id);
  } catch (error) {
    return failureFrom(error, "replyToFeedbackAction", values);
  }
  revalidatePath("/admin/feedback");
  revalidatePath("/admin/feedback/[id]", "page");
  revalidatePath("/account/feedback");
  revalidatePath("/account/notifications");
  return { ok: true, data: undefined, message: FEEDBACK_MESSAGES.replySent };
}

export async function resolveFeedbackAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = feedbackIdSchema.safeParse({ id: readText(formData, "id") });
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await resolveFeedback(parsed.data.id);
  } catch (error) {
    return failureFrom(error, "resolveFeedbackAction", {});
  }
  revalidateFeedbackPages();
  return { ok: true, data: undefined };
}

export async function reopenFeedbackAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = feedbackIdSchema.safeParse({ id: readText(formData, "id") });
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await reopenFeedback(parsed.data.id);
  } catch (error) {
    return failureFrom(error, "reopenFeedbackAction", {});
  }
  revalidateFeedbackPages();
  return { ok: true, data: undefined };
}
