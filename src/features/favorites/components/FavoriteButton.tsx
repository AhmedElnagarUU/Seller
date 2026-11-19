import { ButtonLink } from "@/shared/ui/ButtonLink";
import { FavoriteToggleForm } from "@/features/favorites/components/FavoriteToggleForm";
import { favoriteThemeAction, unfavoriteThemeAction } from "@/features/favorites/favorite.actions";
import { FAVORITE_LABELS } from "@/features/favorites/favorite.constants";

type FavoriteButtonProps = {
  themeId: string;
  themeSlug: string;
  isFavorite: boolean;
  isLoggedIn: boolean;
};

export function FavoriteButton({ themeId, themeSlug, isFavorite, isLoggedIn }: FavoriteButtonProps) {
  if (!isLoggedIn) {
    return (
      <ButtonLink variant="secondary" href={`/login?next=${encodeURIComponent("/themes/" + themeSlug)}`}>
        {FAVORITE_LABELS.favorite}
      </ButtonLink>
    );
  }
  if (isFavorite) {
    return (
      <FavoriteToggleForm
        action={unfavoriteThemeAction}
        targetId={themeId}
        label={FAVORITE_LABELS.unfavorite}
        pendingText="Saving…"
      />
    );
  }
  return (
    <FavoriteToggleForm
      action={favoriteThemeAction}
      targetId={themeId}
      label={FAVORITE_LABELS.favorite}
      pendingText="Saving…"
    />
  );
}
