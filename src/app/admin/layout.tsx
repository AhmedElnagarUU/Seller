import { AdminShell } from "@/shared/layout/AdminShell";
import { requireAdmin } from "@/features/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
