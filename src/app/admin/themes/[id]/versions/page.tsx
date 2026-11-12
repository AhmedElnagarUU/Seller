import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { requireAdmin } from "@/features/auth/session";
import { getThemeForAdmin } from "@/features/themes/theme.service";
import { VersionList } from "@/features/versions/components/admin/VersionList";
import { versionsPageSearchParamsSchema } from "@/features/versions/version.schemas";
import { listVersionsForAdmin } from "@/features/versions/version.service";

export const metadata: Metadata = {
  title: "Versions · Theme Store",
  robots: { index: false },
};

type VersionsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VersionsPage({ params, searchParams }: VersionsPageProps) {
  await requireAdmin();
  const { id } = await params;
  const { released, notified } = versionsPageSearchParamsSchema.parse(await searchParams);
  const theme = await getThemeForAdmin(id);
  if (!theme) notFound();
  const versions = await listVersionsForAdmin(theme.id);

  return (
    <Stack>
      {released ? (
        <Alert tone="success">
          Version {released} released.{notified === "1" ? " Notifications are being sent." : ""}
        </Alert>
      ) : null}
      <Inline justify="between" wrap>
        <Heading level={1}>Versions of {theme.name}</Heading>
        <ButtonLink href={`/admin/themes/${theme.id}/versions/new`}>Upload new version</ButtonLink>
      </Inline>
      {versions.length > 0 ? <VersionList themeId={theme.id} versions={versions} /> : <Text>No versions yet.</Text>}
    </Stack>
  );
}
