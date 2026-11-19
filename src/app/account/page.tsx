import type { Metadata } from "next";
import { requireUser } from "@/features/auth/session";
import { getAccountOverview } from "@/features/users/account.service";
import { AccountOverview } from "@/features/users/components/AccountOverview";

export const metadata: Metadata = { title: "Account · Theme Store", robots: { index: false } };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const overview = await getAccountOverview(user.id);
  return <AccountOverview name={user.name} emailVerified={user.emailVerified} overview={overview} />;
}
