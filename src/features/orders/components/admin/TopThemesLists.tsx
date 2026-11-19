import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import {
  DASHBOARD_MESSAGES,
  DASHBOARD_RANGE_LABELS,
  DASHBOARD_RANGES,
  type DashboardRange,
} from "@/features/orders/dashboard.constants";
import type { TopThemeDTO } from "@/features/orders/dashboard.types";

type TopThemesListsProps = {
  range: DashboardRange;
  bySales: TopThemeDTO[];
  byDownloads: TopThemeDTO[];
};

type TopThemesListProps = {
  title: string;
  range: DashboardRange;
  themes: TopThemeDTO[];
};

function TopThemesList({ title, range, themes }: TopThemesListProps) {
  return (
    <Stack>
      <Heading level={2}>{title}</Heading>
      <Inline gap="sm" wrap>
        {DASHBOARD_RANGES.map((option) => (
          <ButtonLink
            key={option}
            href={`/admin?range=${option}`}
            variant={option === range ? "primary" : "secondary"}
            size="sm"
          >
            {DASHBOARD_RANGE_LABELS[option]}
          </ButtonLink>
        ))}
      </Inline>
      {themes.length === 0 ? <Text>{DASHBOARD_MESSAGES.noTopThemes}</Text> : null}
      {themes.map((theme) => (
        <Inline key={theme.themeId} gap="sm">
          <TextLink href={`/admin/themes/${theme.themeId}`}>{theme.themeName}</TextLink>
          <Text>{String(theme.count)}</Text>
        </Inline>
      ))}
    </Stack>
  );
}

export function TopThemesLists({ range, bySales, byDownloads }: TopThemesListsProps) {
  return (
    <Stack gap="lg">
      <TopThemesList title="Top themes by sales" range={range} themes={bySales} />
      <TopThemesList title="Top themes by downloads" range={range} themes={byDownloads} />
    </Stack>
  );
}
