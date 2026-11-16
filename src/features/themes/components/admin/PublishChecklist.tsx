import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Card } from "@/shared/ui/Card";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import type { PublishChecklistDTO } from "@/features/themes/theme.types";

type PublishChecklistProps = {
  checklist: PublishChecklistDTO;
};

type ChecklistRowProps = {
  isDone: boolean;
  label: string;
};

function ChecklistRow({ isDone, label }: ChecklistRowProps) {
  return (
    <Inline>
      <Badge tone={isDone ? "success" : "danger"}>{isDone ? "✓" : "✗"}</Badge>
      <Text>{label}</Text>
    </Inline>
  );
}

export function PublishChecklist({ checklist }: PublishChecklistProps) {
  return (
    <Card>
      <Stack>
        <Heading level={3}>Publish checklist</Heading>
        <ChecklistRow isDone={checklist.hasVersion} label="At least one version" />
        <ChecklistRow isDone={checklist.hasImage} label="At least one image" />
        <ChecklistRow isDone={checklist.isSynced} label="Synced to Polar" />
        {checklist.isSynced ? null : <Text tone="danger">Not synced with payment provider</Text>}
      </Stack>
    </Card>
  );
}
