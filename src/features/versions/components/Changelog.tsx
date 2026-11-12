import { formatDate } from "@/shared/lib/dates";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Heading } from "@/shared/ui/Heading";
import { Text } from "@/shared/ui/Text";
import { CHANGE_TYPE_LABELS } from "@/features/versions/version.constants";
import type { VersionDTO } from "@/features/versions/version.types";

type ChangelogProps = {
  versions: VersionDTO[];
};

// The public changelog of a theme. Hidden when there are no versions.
export function Changelog({ versions }: ChangelogProps) {
  if (versions.length === 0) return null;

  return (
    <Stack>
      <Heading level={2}>Changelog</Heading>
      {versions.map((version) => (
        <Stack key={version.id} gap="sm">
          <Heading level={3}>
            {version.version} — {formatDate(version.releasedAt)}
          </Heading>
          {version.changes.map((change, index) => (
            <Inline key={`${change.type}-${index}`} gap="sm" align="start">
              <Badge>{CHANGE_TYPE_LABELS[change.type]}</Badge>
              <Text>{change.text}</Text>
            </Inline>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}
