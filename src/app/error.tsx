"use client";

import { PageContainer } from "@/shared/layout/PageContainer";
import { Stack } from "@/shared/layout/Stack";
import { Button } from "@/shared/ui/Button";
import { Heading } from "@/shared/ui/Heading";

type ErrorPageProps = {
  error: Error;
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <PageContainer>
      <Stack align="start">
        <Heading level={1}>Something went wrong.</Heading>
        <Button onClick={reset}>Try again</Button>
      </Stack>
    </PageContainer>
  );
}
