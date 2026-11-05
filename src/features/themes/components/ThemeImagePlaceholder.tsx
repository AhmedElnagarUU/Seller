import { Card } from "@/shared/ui/Card";
import { Text } from "@/shared/ui/Text";

type ThemeImagePlaceholderProps = {
  themeName: string;
};

// Shown instead of a cover image when a theme has no images.
export function ThemeImagePlaceholder({ themeName }: ThemeImagePlaceholderProps) {
  return (
    <Card padding="lg">
      <Text tone="muted" weight="bold">
        {themeName}
      </Text>
    </Card>
  );
}
