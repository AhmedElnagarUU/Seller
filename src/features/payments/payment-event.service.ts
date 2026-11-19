import { withTransaction } from "@/shared/db/transaction";
import { isDuplicateKeyError } from "@/shared/db/duplicate-key";
import { AppError } from "@/shared/errors";
import { now } from "@/shared/lib/clock";
import { sendOrderConfirmationEmail } from "@/features/emails/email.service";
import { ORDER_EVENT_MESSAGES } from "@/features/orders/order.constants";
import { recordCardOrder, recordRefund } from "@/features/orders/order.service";
import type { PaymentEvent, ProviderName } from "@/features/payments/payment.types";
import { WEBHOOK_TYPE_MAX } from "@/features/payments/webhook-event.constants";
import * as webhookEventRepository from "@/features/payments/webhook-event.repository";

export type PaymentEventOutcome = "processed" | "ignored" | "duplicate" | "permanent_failure" | "temporary_failure";

type PaidEvent = Extract<PaymentEvent, { kind: "order_paid" }>;
type RefundEvent = Extract<PaymentEvent, { kind: "order_refunded" }>;

// What the transaction of one event did.
type EventResult = { kind: "paid"; createdOrderId: string | null } | { kind: "refund_missing" } | { kind: "done" };

// Saves the event row. Returns its id, or "duplicate" when the event was handled before.
async function claimEvent(event: PaymentEvent, providerName: ProviderName): Promise<string | "duplicate"> {
  try {
    const created = await webhookEventRepository.insertProcessingEvent({
      provider: providerName,
      eventId: event.eventId,
      type: event.type.slice(0, WEBHOOK_TYPE_MAX),
    });
    return created._id.toString();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
  const existing = await webhookEventRepository.findEvent(providerName, event.eventId);
  if (!existing) throw new Error("webhook event row missing");
  if (existing.status === "processed" || existing.status === "ignored") return "duplicate";
  // "processing" or "failed": this is a retry.
  const rowId = existing._id.toString();
  await webhookEventRepository.setEventStatus(rowId, "processing");
  return rowId;
}

async function processPaid(event: PaidEvent, providerName: ProviderName, rowId: string): Promise<EventResult> {
  return withTransaction(async (session) => {
    const result = await recordCardOrder(event.order, providerName, session);
    await webhookEventRepository.markProcessed(rowId, now(), session);
    return { kind: "paid", createdOrderId: result.outcome === "created" ? result.orderId : null };
  });
}

async function processRefund(event: RefundEvent, providerName: ProviderName, rowId: string): Promise<EventResult> {
  return withTransaction(async (session) => {
    const result = await recordRefund(
      {
        providerName,
        providerOrderId: event.providerOrderId,
        refundedAmount: event.refundedAmount,
        isFullRefund: event.isFullRefund,
      },
      session,
    );
    if (result.outcome === "order_not_found") return { kind: "refund_missing" };
    await webhookEventRepository.markProcessed(rowId, now(), session);
    return { kind: "done" };
  });
}

async function processEvent(event: PaymentEvent, providerName: ProviderName, rowId: string): Promise<EventResult> {
  if (event.kind === "order_paid") return processPaid(event, providerName, rowId);
  if (event.kind === "order_refunded") return processRefund(event, providerName, rowId);
  await webhookEventRepository.setEventStatus(rowId, "ignored", { processedAt: now() });
  return { kind: "done" };
}

// Never the body of the webhook: only the ids and our message.
function logFailure(event: PaymentEvent, message: string): void {
  console.error("payment event failed", { eventId: event.eventId, type: event.type, message });
}

async function failEvent(
  event: PaymentEvent,
  rowId: string,
  message: string,
  outcome: PaymentEventOutcome,
): Promise<PaymentEventOutcome> {
  logFailure(event, message);
  await webhookEventRepository.markFailed(rowId, message);
  return outcome;
}

// The email never changes the outcome of the event.
async function sendConfirmation(orderId: string): Promise<void> {
  try {
    await sendOrderConfirmationEmail({ orderId });
  } catch (error) {
    console.error("sendOrderConfirmationEmail failed", error);
  }
}

// Runs the transaction of the event. A failure is saved on the event row and turned into an outcome.
async function runEvent(event: PaymentEvent, providerName: ProviderName, rowId: string): Promise<PaymentEventOutcome> {
  let result: EventResult;
  try {
    result = await processEvent(event, providerName, rowId);
  } catch (error) {
    if (error instanceof AppError) return failEvent(event, rowId, error.message, "permanent_failure");
    return failEvent(event, rowId, ORDER_EVENT_MESSAGES.temporaryFailure, "temporary_failure");
  }
  if (result.kind === "refund_missing") {
    return failEvent(event, rowId, ORDER_EVENT_MESSAGES.refundOrderMissing, "temporary_failure");
  }
  if (result.kind === "paid" && result.createdOrderId !== null) await sendConfirmation(result.createdOrderId);
  return event.kind === "ignored" ? "ignored" : "processed";
}

// The ONE place that turns a payment event into database changes (D-034). Never throws.
export async function processPaymentEvent(
  event: PaymentEvent,
  providerName: ProviderName,
): Promise<PaymentEventOutcome> {
  let rowId: string | "duplicate";
  try {
    rowId = await claimEvent(event, providerName);
  } catch (error) {
    const message = error instanceof Error ? error.message : ORDER_EVENT_MESSAGES.temporaryFailure;
    console.error("payment event failed", { eventId: event.eventId, type: event.type, message });
    return "temporary_failure";
  }
  if (rowId === "duplicate") return "duplicate";
  try {
    return await runEvent(event, providerName, rowId);
  } catch (error) {
    // The failure could not even be saved on the event row.
    logFailure(event, error instanceof Error ? error.message : ORDER_EVENT_MESSAGES.temporaryFailure);
    return "temporary_failure";
  }
}
