import { env } from "@/shared/config/env";
import { createFakeProvider } from "@/features/payments/fake/fake.provider";
import type { PaymentProvider } from "@/features/payments/payment.types";
import { createPolarProvider } from "@/features/payments/polar/polar.provider";

let provider: PaymentProvider | null = null;

// Polar or fake, chosen by env.PAYMENT_PROVIDER. Created on first use.
export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  provider = env.PAYMENT_PROVIDER === "fake" ? createFakeProvider() : createPolarProvider();
  return provider;
}
