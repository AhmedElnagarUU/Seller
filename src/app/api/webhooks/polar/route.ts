import { handlePaymentWebhook } from "@/features/payments/payment.webhook";

export async function POST(request: Request) {
  return handlePaymentWebhook(request);
}
