"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/Button";

type CopyTextButtonProps = {
  text: string;
};

// Copies the text to the clipboard and shows "Copied" for the rest of the page visit.
export function CopyTextButton({ text }: CopyTextButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
  }

  return (
    <Button size="sm" variant="secondary" onClick={() => void copy()}>
      {isCopied ? "Copied" : "Copy"}
    </Button>
  );
}
