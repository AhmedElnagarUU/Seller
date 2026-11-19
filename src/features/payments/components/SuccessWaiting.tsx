"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stack } from "@/shared/layout/Stack";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";

const REFRESH_DELAY_MS = 3000;
const MAX_REFRESHES = 10;

// Asks the server again every 3 seconds (at most 10 times) while the payment is confirmed by the webhook.
export function SuccessWaiting() {
  const router = useRouter();
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (refreshCount >= MAX_REFRESHES) return;
    const timer = setTimeout(() => {
      router.refresh();
      setRefreshCount((count) => count + 1);
    }, REFRESH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [refreshCount, router]);

  if (refreshCount >= MAX_REFRESHES) {
    return (
      <Text>
        Your payment is being confirmed. This can take a few minutes. We&apos;ll email you as soon as your theme is
        ready.
      </Text>
    );
  }
  return (
    <Stack>
      <Heading level={1}>Confirming your payment…</Heading>
    </Stack>
  );
}
