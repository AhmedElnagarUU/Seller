import Link from "next/link";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { formatPrice } from "@/shared/lib/money";
import { Card } from "@/shared/ui/Card";
import { Heading } from "@/shared/ui/Heading";
import { ImageFrame } from "@/shared/ui/ImageFrame";
import { Text } from "@/shared/ui/Text";
import { ThemeImagePlaceholder } from "@/features/themes/components/ThemeImagePlaceholder";
import type { ThemeCardDTO } from "@/features/themes/theme.types";

const CARD_IMAGE_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

type ThemeCardProps = {
  theme: ThemeCardDTO;
};

// The whole card is one link to the theme page.
export function ThemeCard({ theme }: ThemeCardProps) {
  return (
    <Link href={`/themes/${theme.slug}`} className="block">
      <Card>
        <Stack gap="sm">
          {theme.coverImage ? (
            <ImageFrame src={theme.coverImage.url} alt={theme.coverImage.alt} sizes={CARD_IMAGE_SIZES} />
          ) : (
            <div aria-hidden="true">
              <ThemeImagePlaceholder themeName={theme.name} />
            </div>
          )}
          <Heading level={3}>{theme.name}</Heading>
          <div className="line-clamp-2">
            <Text size="sm" tone="muted">
              {theme.tagline}
            </Text>
          </div>
          <Inline justify="between">
            <Text size="sm" tone="muted">
              {theme.categoryName}
            </Text>
            <Text weight="bold">{formatPrice(theme.priceCents, "usd")}</Text>
          </Inline>
        </Stack>
      </Card>
    </Link>
  );
}
