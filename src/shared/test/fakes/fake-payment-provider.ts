import { createFakeProvider } from "@/features/payments/fake/fake.provider";
import type { PaymentEvent, PaymentProvider, ProviderName } from "@/features/payments/payment.types";

export type RecordedPaymentCall = {
  method: "upsertProduct" | "upsertDiscount" | "createCheckout" | "parseWebhook";
  input: unknown;
};

// Test double for the payment provider (docs/10-testing.md section 4). Records every call and answers like the fake provider.
export class FakePaymentProvider implements PaymentProvider {
  name: ProviderName = "fake";
  calls: RecordedPaymentCall[] = [];
  private nextError: Error | null = null;
  private readonly delegate = createFakeProvider();

  async upsertProduct(input: Parameters<PaymentProvider["upsertProduct"]>[0]): Promise<{ productId: string }> {
    this.record("upsertProduct", input);
    return this.delegate.upsertProduct(input);
  }

  async upsertDiscount(input: Parameters<PaymentProvider["upsertDiscount"]>[0]): Promise<{ discountId: string }> {
    this.record("upsertDiscount", input);
    return this.delegate.upsertDiscount(input);
  }

  async createCheckout(
    input: Parameters<PaymentProvider["createCheckout"]>[0],
  ): Promise<{ checkoutId: string; url: string }> {
    this.record("createCheckout", input);
    return this.delegate.createCheckout(input);
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent> {
    this.record("parseWebhook", { rawBody, headers: Object.fromEntries(headers.entries()) });
    return this.delegate.parseWebhook(rawBody, headers);
  }

  // The next provider call throws this error (once).
  failNext(error: Error): void {
    this.nextError = error;
  }

  reset(): void {
    this.calls = [];
    this.nextError = null;
  }

  private record(method: RecordedPaymentCall["method"], input: unknown): void {
    this.calls.push({ method, input });
    if (!this.nextError) return;
    const error = this.nextError;
    this.nextError = null;
    throw error;
  }
}

// The one shared instance that getPaymentProvider() returns in tests.
export const fakePaymentProvider = new FakePaymentProvider();
