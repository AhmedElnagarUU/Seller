"use client";

import { Button } from "@/shared/ui/Button";
import { authClient } from "@/features/auth/auth-client";

type GoogleButtonProps = {
  callbackPath?: string;
};

export function GoogleButton({ callbackPath }: GoogleButtonProps) {
  function signInWithGoogle() {
    void authClient.signIn.social({
      provider: "google",
      callbackURL: callbackPath ?? "/account",
      errorCallbackURL: "/login",
    });
  }

  return (
    <Button variant="secondary" fullWidth onClick={signInWithGoogle}>
      Continue with Google
    </Button>
  );
}
