import { Inline } from "@/shared/layout/Inline";
import { Button } from "@/shared/ui/Button";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { TextLink } from "@/shared/ui/TextLink";
import { logoutAction } from "@/features/auth/auth.actions";
import type { CurrentUser } from "@/features/users/user.types";

type AccountMenuProps = {
  user: CurrentUser | null;
};

export function AccountMenu({ user }: AccountMenuProps) {
  if (!user) {
    return (
      <Inline gap="md">
        <TextLink href="/login">Log in</TextLink>
        <ButtonLink href="/register" size="sm">
          Sign up
        </ButtonLink>
      </Inline>
    );
  }
  return (
    <Inline gap="md">
      <TextLink href="/account">Account</TextLink>
      <form action={logoutAction}>
        <Button size="sm" variant="ghost" type="submit">
          Log out
        </Button>
      </form>
    </Inline>
  );
}
