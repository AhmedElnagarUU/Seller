"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/Button";

type CopyReferenceButtonProps = {
  referenceCode: string;
};

export function CopyReferenceButton({ referenceCode }: CopyReferenceButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(referenceCode);
    } catch {
      // The browser may refuse the clipboard. The code stays visible on the page, so nothing else is needed.
    }
    setIsCopied(true);
  }

  return (
    <Button variant="secondary" size="sm" onClick={copy}>
      {isCopied ? "Copied" : "Copy"}
    </Button>
  );
}
