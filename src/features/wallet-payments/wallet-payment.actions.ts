"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/shared/types/action";
import { failureFrom, validationFailure } from "@/shared/lib/action-result";
import { readText } from "@/shared/lib/form-data";
import type { PresignedUpload } from "@/shared/storage/s3";
import { requireAdmin, requireUser, requireVerifiedUser } from "@/features/auth/session";
import { WALLET_MESSAGES } from "@/features/wallet-payments/wallet-payment.constants";
import {
  createProofUploadUrlSchema,
  rejectWalletPaymentSchema,
  startWalletPaymentSchema,
  submitWalletProofSchema,
  walletPaymentIdSchema,
} from "@/features/wallet-payments/wallet-payment.schemas";
import { cancelWalletPayment, startWalletPayment } from "@/features/wallet-payments/wallet-payment.service";
import { createProofUploadUrl, submitWalletProof } from "@/features/wallet-payments/wallet-payment-proof.service";
import { approveWalletPayment, rejectWalletPayment } from "@/features/wallet-payments/wallet-payment-review.service";

// validationFailure and failureFrom are typed for actions without data. A failure has the same shape for
// every data type, so this only narrows the type (docs/QUESTIONS.md Q-009).
function asUploadFailure(result: ActionResult): ActionResult<PresignedUpload> {
  if (result.ok) throw new Error("Expected a failed action result.");
  return result;
}

function revalidateCustomerPages(): void {
  revalidatePath("/account/wallet-payments/[id]", "page");
  revalidatePath("/account/orders");
  revalidatePath("/admin/wallet-payments");
}

function revalidateReviewPages(): void {
  revalidatePath("/admin/wallet-payments");
  revalidatePath("/admin/wallet-payments/[id]", "page");
  revalidatePath("/account/wallet-payments/[id]", "page");
  revalidatePath("/account/orders");
  revalidatePath("/account/themes");
}

export async function startWalletPaymentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireVerifiedUser("/checkout/" + readText(formData, "slug"));
  const values = { slug: readText(formData, "slug"), coupon: readText(formData, "coupon") };
  const parsed = startWalletPaymentSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  let walletPaymentId: string;
  try {
    const started = await startWalletPayment({
      userId: user.id,
      themeSlug: parsed.data.slug,
      couponCode: parsed.data.coupon,
    });
    walletPaymentId = started.id;
  } catch (error) {
    return failureFrom(error, "startWalletPaymentAction", values);
  }
  redirect("/account/wallet-payments/" + walletPaymentId);
}

// Called from the browser, not from a form (docs/07-delivery-updates.md section 3.1).
export async function createProofUploadUrlAction(input: {
  walletPaymentId: string;
  contentType: string;
  sizeBytes: number;
}): Promise<ActionResult<PresignedUpload>> {
  const user = await requireUser();
  const parsed = createProofUploadUrlSchema.safeParse(input);
  if (!parsed.success) return asUploadFailure(validationFailure(parsed.error, {}));
  try {
    const upload = await createProofUploadUrl({ userId: user.id, ...parsed.data });
    return { ok: true, data: upload };
  } catch (error) {
    return asUploadFailure(failureFrom(error, "createProofUploadUrlAction", {}));
  }
}

export async function submitWalletProofAction(input: {
  walletPaymentId: string;
  senderPhone: string;
  transactionId: string;
  proofKey: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = submitWalletProofSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await submitWalletProof({ userId: user.id, ...parsed.data });
  } catch (error) {
    return failureFrom(error, "submitWalletProofAction", {});
  }
  revalidateCustomerPages();
  return { ok: true, data: undefined, message: WALLET_MESSAGES.detailsSent };
}

export async function cancelWalletPaymentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = walletPaymentIdSchema.safeParse({ id: readText(formData, "id") });
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await cancelWalletPayment({ userId: user.id, walletPaymentId: parsed.data.id });
  } catch (error) {
    return failureFrom(error, "cancelWalletPaymentAction", {});
  }
  revalidateCustomerPages();
  redirect("/account/wallet-payments/" + parsed.data.id);
}

export async function approveWalletPaymentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = walletPaymentIdSchema.safeParse({ id: readText(formData, "id") });
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await approveWalletPayment({ walletPaymentId: parsed.data.id, adminUserId: user.id });
  } catch (error) {
    return failureFrom(error, "approveWalletPaymentAction", {});
  }
  revalidateReviewPages();
  return { ok: true, data: undefined, message: WALLET_MESSAGES.approved };
}

export async function rejectWalletPaymentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAdmin();
  const values = { reason: readText(formData, "reason") };
  const parsed = rejectWalletPaymentSchema.safeParse({ id: readText(formData, "id"), reason: values.reason });
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    await rejectWalletPayment({ walletPaymentId: parsed.data.id, reason: parsed.data.reason, adminUserId: user.id });
  } catch (error) {
    return failureFrom(error, "rejectWalletPaymentAction", values);
  }
  revalidateReviewPages();
  return { ok: true, data: undefined, message: WALLET_MESSAGES.rejected };
}
