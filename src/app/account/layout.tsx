import { AccountShell } from "@/shared/layout/AccountShell";
import { getCurrentUser } from "@/features/auth/session";

// Does not guard: every account page guards itself.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return <AccountShell isAdmin={user?.isAdmin === true}>{children}</AccountShell>;
}
