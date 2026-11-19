import { parseObjectId } from "@/shared/db/ids";
import { listActivity } from "@/features/activity/activity.service";
import { listFeedbackForUser } from "@/features/feedback/feedback.service";
import { listOrdersForUser } from "@/features/orders/order.service";
import { listOwnershipsForAdmin } from "@/features/ownerships/ownership.service";
import { toCustomerDetailDTO } from "@/features/users/user.mapper";
import * as userRepository from "@/features/users/user.repository";
import type { CustomerAdminPageDTO } from "@/features/users/user.types";
import { listWalletPaymentsForUser } from "@/features/wallet-payments/wallet-payment.service";

// Everything the admin customer page shows, or null for an unknown or invalid id.
export async function getCustomerForAdmin(id: string): Promise<CustomerAdminPageDTO | null> {
  if (!parseObjectId(id)) return null;
  const user = await userRepository.findUserById(id);
  if (!user) return null;
  const [ownerships, orders, walletPayments, feedback, activity] = await Promise.all([
    listOwnershipsForAdmin(id),
    listOrdersForUser(id, 1),
    listWalletPaymentsForUser(id),
    listFeedbackForUser(id),
    listActivity({ customerEmail: user.email, page: 1 }),
  ]);
  return {
    customer: toCustomerDetailDTO(user),
    ownerships,
    orders: orders.items.map((order) => ({
      id: order.id,
      themeName: order.themeName,
      method: order.method,
      currency: order.currency,
      totalAmount: order.totalAmount,
      status: order.status,
      paidAt: order.paidAt,
    })),
    walletPayments: walletPayments.map((payment) => ({
      id: payment.id,
      themeName: payment.themeName,
      amountEgp: payment.amountEgp,
      referenceCode: payment.referenceCode,
      status: payment.status,
    })),
    feedback: feedback.map((message) => ({
      id: message.id,
      subject: message.subject,
      status: message.status,
      createdAt: message.createdAt,
    })),
    activity: activity.items.map((row) => ({ id: row.id, createdAt: row.createdAt, summary: row.summary })),
  };
}
