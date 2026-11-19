import { ButtonLink } from "@/shared/ui/ButtonLink";
import { FavoriteToggleForm } from "@/features/favorites/components/FavoriteToggleForm";
import { followCategoryAction, unfollowCategoryAction } from "@/features/favorites/favorite.actions";
import { FAVORITE_LABELS } from "@/features/favorites/favorite.constants";

type FollowCategoryButtonProps = {
  categoryId: string;
  categorySlug: string;
  isFollowing: boolean;
  isLoggedIn: boolean;
};

export function FollowCategoryButton({ categoryId, categorySlug, isFollowing, isLoggedIn }: FollowCategoryButtonProps) {
  if (!isLoggedIn) {
    return (
      <ButtonLink variant="secondary" href={`/login?next=${encodeURIComponent("/categories/" + categorySlug)}`}>
        {FAVORITE_LABELS.follow}
      </ButtonLink>
    );
  }
  if (isFollowing) {
    return (
      <FavoriteToggleForm
        action={unfollowCategoryAction}
        targetId={categoryId}
        label={FAVORITE_LABELS.unfollow}
        pendingText="Saving…"
      />
    );
  }
  return (
    <FavoriteToggleForm
      action={followCategoryAction}
      targetId={categoryId}
      label={FAVORITE_LABELS.follow}
      pendingText="Saving…"
    />
  );
}
