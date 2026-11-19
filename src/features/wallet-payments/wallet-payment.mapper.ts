import type { WalletPaymentRecord } from "@/features/wallet-payments/wallet-payment.model";
import type {
  WalletPaymentAdminDTO,
  WalletPaymentAdminListItemDTO,
  WalletPaymentDTO,
  WalletPaymentEmailData,
  WalletPaymentListItemDTO,
} from "@/features/wallet-payments/wallet-payment.types";

type Customer = { id: string; name: string; email: string };

export function toWalletPaymentDTO(payment: WalletPaymentRecord): WalletPaymentDTO {
  return {
    id: payment._id.toString(),
    status: payment.status,
    themeId: payment.themeId.toString(),
    themeName: payment.themeSnapshot.name,
    themeSlug: payment.themeSnapshot.slug,
    referenceCode: payment.referenceCode,
    amountEgp: payment.amountEgp,
    senderPhone: payment.senderPhone ?? null,
    transactionId: payment.transactionId ?? null,
    submittedAt: payment.submittedAt ?? null,
    rejectionReason: payment.rejectionReason ?? null,
  };
}

export function toWalletPaymentListItemDTO(payment: WalletPaymentRecord): WalletPaymentListItemDTO {
  return {
    id: payment._id.toString(),
    referenceCode: payment.referenceCode,
    themeName: payment.themeSnapshot.name,
    amountEgp: payment.amountEgp,
    status: payment.status,
  };
}

export function toWalletPaymentAdminListItemDTO(
  payment: WalletPaymentRecord,
  customer: Customer | undefined,
): WalletPaymentAdminListItemDTO {
  return {
    id: payment._id.toString(),
    submittedAt: payment.submittedAt ?? null,
    customerName: customer?.name ?? "",
    customerEmail: customer?.email ?? "",
    themeName: payment.themeSnapshot.name,
    amountEgp: payment.amountEgp,
    referenceCode: payment.referenceCode,
  };
}

export function toWalletPaymentAdminDTO(
  payment: WalletPaymentRecord,
  customer: Customer,
  proofUrl: string | null,
): WalletPaymentAdminDTO {
  return {
    id: payment._id.toString(),
    status: payment.status,
    customer,
    themeName: payment.themeSnapshot.name,
    themeSlug: payment.themeSnapshot.slug,
    amountEgp: payment.amountEgp,
    usdPriceCents: payment.usdPriceCents,
    usdDiscountCents: payment.usdDiscountCents,
    couponCode: payment.couponCode ?? null,
    exchangeRate: payment.exchangeRate,
    referenceCode: payment.referenceCode,
    senderPhone: payment.senderPhone ?? null,
    transactionId: payment.transactionId ?? null,
    proofUrl,
    submittedAt: payment.submittedAt ?? null,
    reviewedAt: payment.reviewedAt ?? null,
    rejectionReason: payment.rejectionReason ?? null,
  };
}

export function toWalletPaymentEmailData(
  payment: WalletPaymentRecord,
  user: { name: string; email: string },
): WalletPaymentEmailData {
  return {
    id: payment._id.toString(),
    userName: user.name,
    userEmail: user.email,
    themeName: payment.themeSnapshot.name,
    amountEgp: payment.amountEgp,
    referenceCode: payment.referenceCode,
    rejectionReason: payment.rejectionReason ?? null,
    senderPhone: payment.senderPhone ?? null,
  };
}
