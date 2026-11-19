import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";
import { FavoriteToggleForm } from "@/features/favorites/components/FavoriteToggleForm";
import { unfollowCategoryAction } from "@/features/favorites/favorite.actions";
import { FAVORITE_LABELS } from "@/features/favorites/favorite.constants";
import type { FollowedCategoryDTO } from "@/features/favorites/favorite.types";

type FollowedCategoriesSectionProps = {
  categories: FollowedCategoryDTO[];
};

export function FollowedCategoriesSection({ categories }: FollowedCategoriesSectionProps) {
  return (
    <Stack>
      <Heading level={2}>Followed categories</Heading>
      {categories.length === 0 ? (
        <Text>You do not follow any category yet.</Text>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <li key={category.id}>
              <Inline>
                <TextLink href={`/categories/${category.slug}`}>{category.name}</TextLink>
                <FavoriteToggleForm
                  action={unfollowCategoryAction}
                  targetId={category.id}
                  label={FAVORITE_LABELS.unfollowFromList}
                  pendingText="Saving…"
                  size="sm"
                  variant="ghost"
                />
              </Inline>
            </li>
          ))}
        </ul>
      )}
    </Stack>
  );
}
