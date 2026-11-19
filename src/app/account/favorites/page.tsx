import type { Metadata } from "next";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { requireUser } from "@/features/auth/session";
import { FavoriteThemesSection } from "@/features/favorites/components/FavoriteThemesSection";
import { FollowedCategoriesSection } from "@/features/favorites/components/FollowedCategoriesSection";
import { listFavorites } from "@/features/favorites/favorite.service";

export const metadata: Metadata = {
  title: "Favorites · Theme Store",
  robots: { index: false },
};

export default async function AccountFavoritesPage() {
  const user = await requireUser("/account/favorites");
  const favorites = await listFavorites(user.id);

  return (
    <Stack gap="lg">
      <Heading level={1}>Favorites</Heading>
      <FavoriteThemesSection themes={favorites.themes} />
      <FollowedCategoriesSection categories={favorites.categories} />
    </Stack>
  );
}
