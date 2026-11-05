import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { requireAdmin } from "@/features/auth/session";

export const metadata: Metadata = {
  title: "Dashboard · Theme Store",
  robots: { index: false },
};

// Temporary page. The dashboard is a later task.
export default async function AdminDashboardPage() {
  await requireAdmin();

  return (
    <Stack>
      <Heading level={1}>Dashboard</Heading>
      <Text>Coming soon.</Text>
    </Stack>
  );
}
