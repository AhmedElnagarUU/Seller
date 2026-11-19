import type { WalletPaymentStatus } from "@/features/wallet-payments/wallet-payment.constants";

export type WalletPaymentDTO = {
  id: string;
  status: WalletPaymentStatus;
  themeId: string;
  themeName: string;
  themeSlug: string;
  referenceCode: string;
  amountEgp: number;
  senderPhone: string | null;
  transactionId: string | null;
  submittedAt: Date | null;
  rejectionReason: string | null;
};

export type WalletAccountDTO = { label: string; account: string; instructions: string };

export type WalletPaymentPageDTO = { payment: WalletPaymentDTO; accounts: WalletAccountDTO[] };

export type WalletPaymentListItemDTO = {
  id: string;
  referenceCode: string;
  themeName: string;
  amountEgp: number;
  status: WalletPaymentStatus;
};

export type WalletPaymentAdminListItemDTO = {
  id: string;
  submittedAt: Date | null;
  customerName: string;
  customerEmail: string;
  themeName: string;
  amountEgp: number;
  referenceCode: string;
};

export type WalletPaymentAdminPageDTO = {
  items: WalletPaymentAdminListItemDTO[];
  page: number;
  totalPages: number;
  total: number;
};

export type WalletPaymentAdminDTO = {
  id: string;
  status: WalletPaymentStatus;
  customer: { id: string; name: string; email: string };
  themeName: string;
  themeSlug: string;
  amountEgp: number;
  usdPriceCents: number;
  usdDiscountCents: number;
  couponCode: string | null;
  exchangeRate: number;
  referenceCode: string;
  senderPhone: string | null;
  transactionId: string | null;
  proofUrl: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
};

// What the three wallet emails need.
export type WalletPaymentEmailData = {
  id: string;
  userName: string;
  userEmail: string;
  themeName: string;
  amountEgp: number;
  referenceCode: string;
  rejectionReason: string | null;
  senderPhone: string | null;
};
