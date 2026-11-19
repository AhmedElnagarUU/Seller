import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { requireAdmin } from "@/features/auth/session";
import { AnnouncementForm } from "@/features/notifications/components/admin/AnnouncementForm";
import { listThemeOptionsForAdmin } from "@/features/themes/theme.service";

export const metadata: Metadata = {
  title: "New announcement · Theme Store",
  robots: { index: false },
};

export default async function NewAnnouncementPage() {
  await requireAdmin();
  const themes = await listThemeOptionsForAdmin();

  return (
    <Stack>
      <Heading level={1}>New announcement</Heading>
      <AnnouncementForm themes={themes} />
    </Stack>
  );
}
