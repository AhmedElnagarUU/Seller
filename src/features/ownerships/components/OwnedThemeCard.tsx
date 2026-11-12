import { formatDate } from "@/shared/lib/dates";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Card } from "@/shared/ui/Card";
import { Heading } from "@/shared/ui/Heading";
import { ImageFrame } from "@/shared/ui/ImageFrame";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { DownloadButton } from "@/features/downloads/components/DownloadButton";
import type { OwnedThemeDTO } from "@/features/ownerships/ownership.types";
import { ThemeImagePlaceholder } from "@/features/themes/components/ThemeImagePlaceholder";

const CARD_IMAGE_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

type OwnedThemeCardProps = {
  owned: OwnedThemeDTO;
};

function ThemeName({ owned }: OwnedThemeCardProps) {
  const { theme } = owned;
  if (theme.status === "published") {
    return (
      <Heading level={3}>
        <TextLink href={`/themes/${theme.slug}`}>{theme.name}</TextLink>
      </Heading>
    );
  }
  return (
    <Inline gap="sm" wrap>
      <Heading level={3}>{theme.name}</Heading>
      <Badge>No longer sold</Badge>
    </Inline>
  );
}

function OlderVersions({ versions }: { versions: OwnedThemeDTO["versions"] }) {
  if (versions.length === 0) return null;
  return (
    <details>
      <summary>
        <Text as="span">Older versions</Text>
      </summary>
      <Stack gap="sm">
        {versions.map((version) => (
          <Inline key={version.id} justify="between">
            <Text>
              {version.version} · {formatDate(version.releasedAt)}
            </Text>
            <DownloadButton
              versionId={version.id}
              label={`Download ${version.version}`}
              size="sm"
              variant="secondary"
            />
          </Inline>
        ))}
      </Stack>
    </details>
  );
}

// One theme of "My themes": the cover, the name, the latest version to download and the older versions.
export function OwnedThemeCard({ owned }: OwnedThemeCardProps) {
  const { theme, versions } = owned;
  const [latest, ...olderVersions] = versions;

  return (
    <Card>
      <Stack gap="sm">
        {theme.coverImage ? (
          <ImageFrame src={theme.coverImage.url} alt={theme.coverImage.alt} sizes={CARD_IMAGE_SIZES} />
        ) : (
          <div aria-hidden="true">
            <ThemeImagePlaceholder themeName={theme.name} />
          </div>
        )}
        <ThemeName owned={owned} />
        {latest ? (
          <>
            <Text size="sm" tone="muted">
              Version {latest.version} · Updated {formatDate(latest.releasedAt)}
            </Text>
            <DownloadButton versionId={latest.id} label={`Download ${latest.version}`} />
            <OlderVersions versions={olderVersions} />
          </>
        ) : (
          <Text>The first version is coming soon.</Text>
        )}
      </Stack>
    </Card>
  );
}
