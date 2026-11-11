"use client";

import { readText } from "@/shared/lib/form-data";
import { Inline } from "@/shared/layout/Inline";
import { Stack } from "@/shared/layout/Stack";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { ImageFrame } from "@/shared/ui/ImageFrame";
import { TextField } from "@/shared/ui/TextField";
import type { ThemeAdminImageDTO } from "@/features/themes/theme.types";

type ThemeImageRowProps = {
  image: ThemeAdminImageDTO;
  // 1 for the first image (the cover), 2 for the second…
  position: number;
  isLast: boolean;
  disabled: boolean;
  onSaveAlt: (alt: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

export function ThemeImageRow({
  image,
  position,
  isLast,
  disabled,
  onSaveAlt,
  onMoveUp,
  onMoveDown,
  onRemove,
}: ThemeImageRowProps) {
  const isFirst = position === 1;

  return (
    <Card>
      <Stack>
        <Inline align="start" wrap>
          <div className="w-40">
            <ImageFrame src={image.url} alt={image.alt} sizes="160px" />
          </div>
          {isFirst ? <Badge tone="primary">Cover</Badge> : null}
        </Inline>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSaveAlt(readText(new FormData(event.currentTarget), "alt"));
          }}
        >
          <Inline align="end" wrap>
            <TextField label={`Alt text for image ${position}`} name="alt" defaultValue={image.alt} />
            <Button type="submit" size="sm" variant="secondary" disabled={disabled}>
              Save alt text for image {position}
            </Button>
          </Inline>
        </form>
        <Inline gap="sm" wrap>
          <Button size="sm" variant="secondary" disabled={disabled || isFirst} onClick={onMoveUp}>
            Move image {position} up
          </Button>
          <Button size="sm" variant="secondary" disabled={disabled || isLast} onClick={onMoveDown}>
            Move image {position} down
          </Button>
          <Button size="sm" variant="danger" disabled={disabled} onClick={onRemove}>
            Remove image {position}
          </Button>
        </Inline>
      </Stack>
    </Card>
  );
}
