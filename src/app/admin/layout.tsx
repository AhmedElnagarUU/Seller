import { AdminShell } from "@/shared/layout/AdminShell";
import { requireAdmin } from "@/features/auth/session";
import { countNewFeedback } from "@/features/feedback/feedback.service";
import { countSubmittedWalletPayments } from "@/features/wallet-payments/wallet-payment-review.service";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [waitingWalletPayments, newFeedback] = await Promise.all([countSubmittedWalletPayments(), countNewFeedback()]);
  return (
    <AdminShell badges={{ "/admin/wallet-payments": waitingWalletPayments, "/admin/feedback": newFeedback }}>
      {children}
    </AdminShell>
  );
}
