"use client";

import { useState } from "react";
import { IMAGE_CONTENT_TYPES } from "@/shared/storage/keys";
import { uploadFile } from "@/shared/storage/upload-file";
import { createProofUploadUrlAction } from "@/features/wallet-payments/wallet-payment.actions";
import { MAX_PROOF_BYTES, WALLET_MESSAGES } from "@/features/wallet-payments/wallet-payment.constants";

const UPLOAD_FAILED_MESSAGE = "The upload failed. Please check your connection and try again.";

type UploadStatus = "idle" | "uploading" | "uploaded" | "failed";

type WalletProofUpload = {
  status: UploadStatus;
  progress: number;
  errorMessage: string | null;
  proofKey: string | null;
  start: (file: File) => Promise<void>;
};

function isAllowedImage(file: File): boolean {
  const isAllowedType = IMAGE_CONTENT_TYPES.some((type) => type === file.type);
  return isAllowedType && file.size >= 1 && file.size <= MAX_PROOF_BYTES;
}

// Uploads the screenshot of the transfer straight to storage (docs/06-payments.md section 7.5).
export function useWalletProofUpload(walletPaymentId: string): WalletProofUpload {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [proofKey, setProofKey] = useState<string | null>(null);

  function fail(message: string): void {
    setStatus("failed");
    setErrorMessage(message);
  }

  async function start(file: File): Promise<void> {
    setProofKey(null);
    setErrorMessage(null);
    setProgress(0);
    if (!isAllowedImage(file)) return fail(WALLET_MESSAGES.proofType);
    setStatus("uploading");
    const result = await createProofUploadUrlAction({
      walletPaymentId,
      contentType: file.type,
      sizeBytes: file.size,
    });
    if (!result.ok) return fail(result.error);
    try {
      await uploadFile(result.data, file, setProgress);
    } catch {
      return fail(UPLOAD_FAILED_MESSAGE);
    }
    setStatus("uploaded");
    setProofKey(result.data.key);
  }

  return { status, progress, errorMessage, proofKey, start };
}
