import type { Metadata } from "next";
import { Grid } from "@/shared/layout/Grid";
import { Stack } from "@/shared/layout/Stack";
import { Alert } from "@/shared/ui/Alert";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { requireUser } from "@/features/auth/session";
import { DOWNLOAD_ERROR_MESSAGES } from "@/features/downloads/download.constants";
import { downloadErrorSearchParamsSchema } from "@/features/downloads/download.schemas";
import { OwnedThemeCard } from "@/features/ownerships/components/OwnedThemeCard";
import { listOwnedThemes } from "@/features/ownerships/ownership.service";

export const metadata: Metadata = {
  title: "My themes · Theme Store",
  robots: { index: false },
};

type AccountThemesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountThemesPage({ searchParams }: AccountThemesPageProps) {
  const user = await requireUser("/account/themes");
  const { downloadError } = downloadErrorSearchParamsSchema.parse(await searchParams);
  const ownedThemes = await listOwnedThemes(user.id);

  return (
    <Stack>
      <Heading level={1}>My themes</Heading>
      {downloadError ? <Alert tone="danger">{DOWNLOAD_ERROR_MESSAGES[downloadError]}</Alert> : null}
      {ownedThemes.length === 0 ? (
        <Stack gap="sm" align="start">
          <Text>You do not own any themes yet.</Text>
          <ButtonLink href="/themes">Browse themes</ButtonLink>
        </Stack>
      ) : (
        <Grid columns={3}>
          {ownedThemes.map((owned) => (
            <OwnedThemeCard key={owned.theme.id} owned={owned} />
          ))}
        </Grid>
      )}
    </Stack>
  );
}
