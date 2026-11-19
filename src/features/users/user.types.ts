import type { FeedbackStatus } from "@/features/feedback/feedback.constants";
import type { OrderCurrency, OrderMethod, OrderStatus } from "@/features/orders/order.constants";
import type { OwnershipAdminRowDTO } from "@/features/ownerships/ownership.types";
import type { WalletPaymentStatus } from "@/features/wallet-payments/wallet-payment.constants";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  country: string | null;
};

// The few user fields that payments and emails need.
export type UserSummary = {
  id: string;
  name: string;
  email: string;
  country: string | null;
};

// What a notification job needs to know about a customer: the address and the four email switches.
export type NotificationUserDTO = {
  id: string;
  name: string;
  email: string;
  disabled: boolean;
  emailOwnedThemeUpdates: boolean;
  emailFavoriteThemeUpdates: boolean;
  emailFollowedCategoryThemes: boolean;
  emailAnnouncements: boolean;
};

// One row of /admin/customers.
export type CustomerListItemDTO = {
  id: string;
  name: string;
  email: string;
  country: string | null;
  ownedCount: number;
  createdAt: Date;
  isDisabled: boolean;
};

export type CustomerDetailDTO = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  country: string | null;
  createdAt: Date;
  isDisabled: boolean;
  disabledReason: string | null;
  disabledAt: Date | null;
};

export type CustomerPageDTO = {
  items: CustomerListItemDTO[];
  page: number;
  totalPages: number;
  total: number;
};

// Rows on the customer page. Filled from the DTOs of other features inside customer-admin.service.ts.
export type CustomerOrderRowDTO = {
  id: string;
  themeName: string;
  method: OrderMethod;
  currency: OrderCurrency;
  totalAmount: number;
  status: OrderStatus;
  paidAt: Date;
};

export type CustomerWalletRowDTO = {
  id: string;
  themeName: string;
  amountEgp: number;
  referenceCode: string;
  status: WalletPaymentStatus;
};

export type CustomerFeedbackRowDTO = { id: string; subject: string; status: FeedbackStatus; createdAt: Date };

export type CustomerActivityRowDTO = { id: string; createdAt: Date; summary: string };

export type CustomerAdminPageDTO = {
  customer: CustomerDetailDTO;
  ownerships: OwnershipAdminRowDTO[];
  orders: CustomerOrderRowDTO[];
  walletPayments: CustomerWalletRowDTO[];
  feedback: CustomerFeedbackRowDTO[];
  activity: CustomerActivityRowDTO[];
};
