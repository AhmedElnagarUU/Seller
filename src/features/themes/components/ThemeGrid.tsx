import { Grid } from "@/shared/layout/Grid";
import { ThemeCard } from "@/features/themes/components/ThemeCard";
import type { ThemeCardDTO } from "@/features/themes/theme.types";

type ThemeGridProps = {
  themes: ThemeCardDTO[];
};

export function ThemeGrid({ themes }: ThemeGridProps) {
  return (
    <Grid columns={3}>
      {themes.map((theme) => (
        <ThemeCard key={theme.id} theme={theme} />
      ))}
    </Grid>
  );
}
