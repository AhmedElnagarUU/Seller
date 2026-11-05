import { Grid } from "@/shared/layout/Grid";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { formatDate } from "@/shared/lib/dates";
import { formatPrice } from "@/shared/lib/money";
import { ButtonAnchor } from "@/shared/ui/ButtonAnchor";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Heading } from "@/shared/ui/Heading";
import { MarkdownText } from "@/shared/ui/MarkdownText";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { ThemeGallery } from "@/features/themes/components/ThemeGallery";
import type { ThemeDetailDTO } from "@/features/themes/theme.types";

type ThemeDetailProps = {
  theme: ThemeDetailDTO;
};

function describeVersion(theme: ThemeDetailDTO): string | null {
  if (!theme.latestVersion || !theme.latestVersionReleasedAt) return null;
  return `Version ${theme.latestVersion} · Updated ${formatDate(theme.latestVersionReleasedAt)}`;
}

export function ThemeDetail({ theme }: ThemeDetailProps) {
  const versionText = describeVersion(theme);

  return (
    <Stack gap="xl">
      <Grid columns={2} gap="xl">
        <ThemeGallery themeName={theme.name} images={theme.images} />
        <Stack>
          <Heading level={1}>{theme.name}</Heading>
          <Text tone="muted">{theme.tagline}</Text>
          <Text size="lg" weight="bold">
            {formatPrice(theme.priceCents, "usd")}
          </Text>
          <TextLink href={`/categories/${theme.category.slug}`}>{theme.category.name}</TextLink>
          {versionText ? (
            <Text size="sm" tone="muted">
              {versionText}
            </Text>
          ) : null}
          <Stack gap="xs">
            <Text size="sm">WordPress {theme.requirements.wordpressMin}+</Text>
            <Text size="sm">PHP {theme.requirements.phpMin}+</Text>
            <Text size="sm">Tested up to WordPress {theme.requirements.testedUpTo}</Text>
          </Stack>
          <Inline wrap>
            <ButtonLink href={`/checkout/${theme.slug}`}>Buy now</ButtonLink>
            {theme.demoUrl ? (
              <ButtonAnchor href={theme.demoUrl} variant="secondary" rel="noopener noreferrer">
                Live demo
              </ButtonAnchor>
            ) : null}
          </Inline>
        </Stack>
      </Grid>
      <Stack>
        <Heading level={2}>Description</Heading>
        <MarkdownText>{theme.description}</MarkdownText>
      </Stack>
      {theme.features.length > 0 ? (
        <Stack>
          <Heading level={2}>Features</Heading>
          <ul className="flex flex-col gap-1">
            {theme.features.map((feature) => (
              <li key={feature}>
                <Text as="span">{feature}</Text>
              </li>
            ))}
          </ul>
        </Stack>
      ) : null}
    </Stack>
  );
}
