"use client";

import { useState, useTransition } from "react";
import { uploadFile } from "@/shared/storage/upload-file";
import { MAX_ZIP_BYTES, VERSION_MESSAGES } from "@/features/versions/version.constants";
import { createVersionAction, createZipUploadUrlAction } from "@/features/versions/version.actions";
import type { ChangeEntryDTO } from "@/features/versions/version.types";

// What the form gives the hook when the admin clicks "Upload and release".
export type VersionUploadInput = {
  version: string;
  changes: ChangeEntryDTO[];
  notify: boolean;
  file: File | null;
};

type UploadStep = "idle" | "uploading" | "checking";

type VersionUpload = {
  error: string | null;
  fieldErrors: Record<string, string[]>;
  percent: number;
  step: UploadStep;
  // true from the click until the page changes (the button stays disabled while the action redirects).
  isBusy: boolean;
  submit: (input: VersionUploadInput) => void;
};

type StepResult = { error: string | null; fieldErrors: Record<string, string[]> };

function failed(error: string, fieldErrors: Record<string, string[]> = {}): StepResult {
  return { error, fieldErrors };
}

// The browser checks of docs/07-delivery-updates.md section 4.1 step 1.
function isAllowedZip(file: File | null): file is File {
  if (!file) return false;
  return file.name.toLowerCase().endsWith(".zip") && file.size >= 1 && file.size <= MAX_ZIP_BYTES;
}

// Runs steps 1 to 4 of docs/07-delivery-updates.md section 4.1. On success the action redirects, so this
// only returns when something went wrong.
async function releaseVersion(
  themeId: string,
  input: VersionUploadInput,
  setStep: (step: UploadStep) => void,
  setPercent: (percent: number) => void,
): Promise<StepResult> {
  const { file } = input;
  if (!isAllowedZip(file)) return failed(VERSION_MESSAGES.invalidZip);
  const upload = await createZipUploadUrlAction({ themeId, fileName: file.name, sizeBytes: file.size });
  if (!upload.ok) return failed(upload.error);
  setStep("uploading");
  try {
    await uploadFile(upload.data, file, setPercent);
  } catch {
    return failed(VERSION_MESSAGES.uploadFailed);
  }
  setStep("checking");
  const created = await createVersionAction({
    themeId,
    version: input.version,
    changes: input.changes,
    notify: input.notify,
    fileKey: upload.data.key,
    originalName: file.name,
  });
  if (created.ok) return { error: null, fieldErrors: {} };
  return failed(created.error, created.fieldErrors);
}

export function useVersionUpload(themeId: string): VersionUpload {
  const [result, setResult] = useState<StepResult>({ error: null, fieldErrors: {} });
  const [percent, setPercent] = useState(0);
  const [step, setStep] = useState<UploadStep>("idle");
  const [isBusy, startTransition] = useTransition();

  function submit(input: VersionUploadInput): void {
    setResult({ error: null, fieldErrors: {} });
    setPercent(0);
    startTransition(async () => {
      const finished = await releaseVersion(themeId, input, setStep, setPercent);
      setStep("idle");
      setResult(finished);
    });
  }

  return { error: result.error, fieldErrors: result.fieldErrors, percent, step, isBusy, submit };
}
