"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/shared/types/action";
import { readText } from "@/shared/lib/form-data";
import { Stack } from "@/shared/layout/Stack";
import { Button } from "@/shared/ui/Button";
import { FileField } from "@/shared/ui/FileField";
import { FormError } from "@/shared/ui/FormError";
import { Text } from "@/shared/ui/Text";
import { TextField } from "@/shared/ui/TextField";
import { submitWalletProofAction } from "@/features/wallet-payments/wallet-payment.actions";
import { useWalletProofUpload } from "@/features/wallet-payments/components/useWalletProofUpload";

type WalletProofFormProps = {
  walletPaymentId: string;
};

export function WalletProofForm({ walletPaymentId }: WalletProofFormProps) {
  const router = useRouter();
  const upload = useWalletProofUpload(walletPaymentId);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const failure = result?.ok === false ? result : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (upload.proofKey === null) return;
    const proofKey = upload.proofKey;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const submitted = await submitWalletProofAction({
        walletPaymentId,
        senderPhone: readText(formData, "senderPhone"),
        transactionId: readText(formData, "transactionId"),
        proofKey,
      });
      setResult(submitted);
      if (submitted.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        <FileField
          label="Screenshot of the transfer"
          name="screenshot"
          accept="image/jpeg,image/png,image/webp"
          onChange={(file) => {
            if (file) void upload.start(file);
          }}
        />
        {upload.status === "uploading" ? <Text>{`Uploading… ${upload.progress}%`}</Text> : null}
        {upload.status === "uploaded" ? <Text tone="success">Screenshot uploaded.</Text> : null}
        {upload.errorMessage ? <Text tone="danger">{upload.errorMessage}</Text> : null}
        <TextField
          label="Phone number you paid from"
          name="senderPhone"
          type="tel"
          errors={failure?.fieldErrors?.senderPhone}
        />
        <TextField
          label="Transaction ID (optional)"
          name="transactionId"
          errors={failure?.fieldErrors?.transactionId}
        />
        <FormError message={failure?.error} />
        <Button type="submit" disabled={upload.status !== "uploaded" || isPending}>
          {isPending ? "Sending…" : "Send payment details"}
        </Button>
      </Stack>
    </form>
  );
}
