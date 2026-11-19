import { getPaymentProvider } from "@/features/payments/payment.provider";
import { processPaymentEvent } from "@/features/payments/payment-event.service";
import {
  WebhookPayloadError,
  WebhookSignatureError,
  type PaymentEvent,
  type PaymentProvider,
} from "@/features/payments/payment.types";

function temporaryFailure(): Response {
  return Response.json({ error: "Temporary failure" }, { status: 500 });
}

// The event of the request, or the response to send back when the request is not usable.
async function readEvent(request: Request, provider: PaymentProvider): Promise<PaymentEvent | Response> {
  const rawBody = await request.text();
  try {
    return await provider.parseWebhook(rawBody, request.headers);
  } catch (error) {
    if (error instanceof WebhookSignatureError) return Response.json({ error: "Invalid signature" }, { status: 403 });
    if (error instanceof WebhookPayloadError) return Response.json({ error: "Invalid body" }, { status: 400 });
    console.error("payment webhook failed", error instanceof Error ? error.message : "unknown error");
    return temporaryFailure();
  }
}

// Uses only the standard Request / Response types, so it can move to Express (docs/06-payments.md section 1).
// Temporary problems answer 500 so the provider sends the webhook again; permanent ones answer 200 (06 section 6.1).
export async function handlePaymentWebhook(
  request: Request,
  provider: PaymentProvider = getPaymentProvider(),
): Promise<Response> {
  const event = await readEvent(request, provider);
  if (event instanceof Response) return event;
  const outcome = await processPaymentEvent(event, provider.name);
  if (outcome === "temporary_failure") return temporaryFailure();
  return Response.json({ received: true }, { status: 200 });
}
