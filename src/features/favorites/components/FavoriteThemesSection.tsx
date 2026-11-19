import { Grid } from "@/shared/layout/Grid";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { FavoriteToggleForm } from "@/features/favorites/components/FavoriteToggleForm";
import { unfavoriteThemeAction } from "@/features/favorites/favorite.actions";
import { FAVORITE_LABELS } from "@/features/favorites/favorite.constants";
import { ThemeCard } from "@/features/themes/components/ThemeCard";
import type { ThemeCardDTO } from "@/features/themes/theme.types";

type FavoriteThemesSectionProps = {
  themes: ThemeCardDTO[];
};

export function FavoriteThemesSection({ themes }: FavoriteThemesSectionProps) {
  return (
    <Stack>
      <Heading level={2}>Favorite themes</Heading>
      {themes.length === 0 ? (
        <Text>You have no favorite themes yet.</Text>
      ) : (
        <Grid columns={3}>
          {themes.map((theme) => (
            <Stack key={theme.id}>
              <ThemeCard theme={theme} />
              <FavoriteToggleForm
                action={unfavoriteThemeAction}
                targetId={theme.id}
                label={FAVORITE_LABELS.removeFromList}
                pendingText="Saving…"
                size="sm"
                variant="ghost"
              />
            </Stack>
          ))}
        </Grid>
      )}
    </Stack>
  );
}
