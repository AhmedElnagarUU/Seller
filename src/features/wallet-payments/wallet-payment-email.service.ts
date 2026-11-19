import { getUserSummary } from "@/features/users/user.service";
import { toWalletPaymentEmailData } from "@/features/wallet-payments/wallet-payment.mapper";
import * as walletPaymentRepository from "@/features/wallet-payments/wallet-payment.repository";
import type { WalletPaymentEmailData } from "@/features/wallet-payments/wallet-payment.types";

// The data of the wallet emails, or null when the request or its customer does not exist.
// It does not import email.service.ts, because email.service.ts imports this file.
export async function getWalletPaymentEmailData(id: string): Promise<WalletPaymentEmailData | null> {
  const payment = await walletPaymentRepository.findWalletPaymentById(id);
  if (!payment) return null;
  const user = await getUserSummary(payment.userId.toString());
  if (!user) return null;
  return toWalletPaymentEmailData(payment, user);
}
