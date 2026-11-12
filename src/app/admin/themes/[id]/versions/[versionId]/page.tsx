import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { TextLink } from "@/shared/ui/TextLink";
import { requireAdmin } from "@/features/auth/session";
import { getThemeForAdmin } from "@/features/themes/theme.service";
import { VersionChangesForm } from "@/features/versions/components/admin/VersionChangesForm";
import { getVersionForAdmin } from "@/features/versions/version.service";

export const metadata: Metadata = {
  title: "Edit changelog · Theme Store",
  robots: { index: false },
};

type EditVersionPageProps = {
  params: Promise<{ id: string; versionId: string }>;
};

export default async function EditVersionPage({ params }: EditVersionPageProps) {
  await requireAdmin();
  const { id, versionId } = await params;
  const theme = await getThemeForAdmin(id);
  if (!theme) notFound();
  const version = await getVersionForAdmin(theme.id, versionId);
  if (!version) notFound();

  return (
    <Stack>
      <Heading level={1}>
        Edit changelog: {theme.name} {version.version}
      </Heading>
      <TextLink href={`/admin/themes/${theme.id}/versions`}>Back to versions</TextLink>
      <VersionChangesForm versionId={version.id} changes={version.changes} />
    </Stack>
  );
}
