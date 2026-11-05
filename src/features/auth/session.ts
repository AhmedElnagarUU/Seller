import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/features/auth/auth";
import { isAdminEmail } from "@/features/users/user.service";
import type { CurrentUser } from "@/features/users/user.types";

// The logged-in user, or null. A disabled user counts as not logged in (extra safety on top of the hook, D-121).
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { user } = session;
  if (user.disabled === true) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    isAdmin: isAdminEmail(user.email),
    country: user.country ?? null,
  };
});

// Needs a logged-in user, otherwise redirects to the login page. `currentPath` is the page to come back to.
export async function requireUser(currentPath: string = "/"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  return user;
}

// Needs a logged-in user with a verified email.
export async function requireVerifiedUser(currentPath: string = "/"): Promise<CurrentUser> {
  const user = await requireUser(currentPath);
  if (!user.emailVerified) redirect("/verify-email");
  return user;
}

// Needs an admin. Everyone else gets a 404: the admin area must look like it does not exist.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();
  return user;
}
