import { AdminShell } from "@/shared/layout/AdminShell";
import { requireAdmin } from "@/features/auth/session";
import { countSubmittedWalletPayments } from "@/features/wallet-payments/wallet-payment-review.service";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const waitingWalletPayments = await countSubmittedWalletPayments();
  return <AdminShell badges={{ "/admin/wallet-payments": waitingWalletPayments }}>{children}</AdminShell>;
}
