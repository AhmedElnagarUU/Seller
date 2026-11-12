import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { requireAdmin } from "@/features/auth/session";
import { getThemeForAdmin } from "@/features/themes/theme.service";
import { VersionForm } from "@/features/versions/components/admin/VersionForm";

export const metadata: Metadata = {
  title: "Upload a new version · Theme Store",
  robots: { index: false },
};

type NewVersionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewVersionPage({ params }: NewVersionPageProps) {
  await requireAdmin();
  const { id } = await params;
  const theme = await getThemeForAdmin(id);
  if (!theme) notFound();

  return (
    <Stack>
      <Heading level={1}>Upload a new version</Heading>
      <VersionForm themeId={theme.id} latestVersion={theme.latestVersion} />
    </Stack>
  );
}
