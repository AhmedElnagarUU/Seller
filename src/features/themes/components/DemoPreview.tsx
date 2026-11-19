"use client";

import { useState } from "react";
import { Inline } from "@/shared/layout/Inline";
import { PreviewBar } from "@/shared/layout/PreviewBar";
import { formatPrice } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { EmbedFrame } from "@/shared/ui/EmbedFrame";
import { Text } from "@/shared/ui/Text";
import { TextLink } from "@/shared/ui/TextLink";

type Device = "desktop" | "tablet" | "mobile";

const DEVICES: { value: Device; label: string }[] = [
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile", label: "Mobile" },
];

type DemoPreviewProps = {
  themeName: string;
  themeSlug: string;
  priceCents: number;
  demoUrl: string;
};

export function DemoPreview({ themeName, themeSlug, priceCents, demoUrl }: DemoPreviewProps) {
  const [device, setDevice] = useState<Device>("desktop");

  return (
    <>
      <PreviewBar>
        <Inline justify="between" wrap>
          <TextLink href={`/themes/${themeSlug}`}>← {themeName}</TextLink>
          <Text>{formatPrice(priceCents, "usd")}</Text>
          <Inline gap="sm">
            {DEVICES.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={device === option.value ? "primary" : "secondary"}
                onClick={() => setDevice(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </Inline>
          <ButtonLink size="sm" href={`/checkout/${themeSlug}`}>
            Buy now
          </ButtonLink>
        </Inline>
      </PreviewBar>
      <div className="min-h-0 flex-1">
        <EmbedFrame src={demoUrl} title={`${themeName} live demo`} width={device} />
      </div>
    </>
  );
}
